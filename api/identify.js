import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { DAY_LOCATIONS } from '../src/data/locations.js';
import { ANTHROPIC_VISION_MODEL } from './_aiModel.js';

// Try to import exifr - it may not work in all serverless environments
let exifr = null;
try {
  exifr = await import('exifr');
} catch (e) {
  console.log('exifr not available, GPS extraction disabled');
}

// Format raw EXIF coordinates with the correct hemisphere (handles S/W, not just N/E).
function formatCoords(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

// Reverse-geocode coordinates to a human place name via OpenStreetMap Nominatim
// (free, no API key). Best-effort: a failure/timeout returns null and the caller
// falls back to raw coordinates — geocoding must never break identification.
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=14&addressdetails=0`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      // Nominatim's usage policy requires an identifying User-Agent.
      headers: { 'User-Agent': 'voyage-journal/1.0 (trip photo identifier)' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch (err) {
    console.log('Reverse geocode unavailable:', err?.message);
    return null;
  }
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !anthropicKey) {
    console.error('Missing env vars:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnthropicKey: !!anthropicKey,
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  // Create clients
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the JWT token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { photo_id, storage_path, day_context, user_hint, user_coords } = req.body;

  if (!photo_id || !storage_path || !day_context) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Download the photo from Supabase Storage
    const { data: photoData, error: downloadError } = await supabase.storage
      .from('photos')
      .download(storage_path);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return res.status(500).json({ error: 'Failed to download photo' });
    }

    // Convert to buffer
    const arrayBuffer = await photoData.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Extract EXIF data including GPS coordinates (if exifr is available).
    // When GPS is present we reverse-geocode it to a place name and treat that
    // as strong evidence of where the photo was taken (the camera's position).
    let gpsInfo = '';
    if (exifr) {
      try {
        const exifData = await exifr.parse(imageBuffer, {
          gps: true,
          pick: ['latitude', 'longitude', 'DateTimeOriginal', 'Make', 'Model'],
        });
        if (exifData?.latitude && exifData?.longitude) {
          const lat = exifData.latitude, lon = exifData.longitude;
          gpsInfo = `\nGPS coordinates: ${formatCoords(lat, lon)}`;
          const place = await reverseGeocode(lat, lon);
          if (place) {
            gpsInfo += `\nGPS-derived location (where the photo was taken — strong, reliable evidence of the camera's position; the main subject may be something viewed from here): ${place}`;
          }
          console.log(`Photo GPS: ${lat}, ${lon}${place ? ' -> ' + place : ''}`);
        }
      } catch (exifErr) {
        console.log('No EXIF data available:', exifErr.message);
      }
    }

    // User-provided clarification from the "Refine" flow — the most authoritative
    // signal, since the user was actually there. A free-text hint and/or the
    // user's current device location (reverse-geocoded) when they tap "use my
    // location" at the spot.
    let userContext = '';
    if (typeof user_hint === 'string' && user_hint.trim()) {
      userContext += `\nThe user, who was present, says about this photo: "${user_hint.trim().slice(0, 300)}". Treat this as AUTHORITATIVE — correct the location/subject to match it.`;
    }
    if (user_coords && Number.isFinite(user_coords.lat) && Number.isFinite(user_coords.lon)
        && Math.abs(user_coords.lat) <= 90 && Math.abs(user_coords.lon) <= 180) {
      const place = await reverseGeocode(user_coords.lat, user_coords.lon);
      userContext += place
        ? `\nThe user indicates (from their current location) the photo was taken at or near: ${place}. Treat this as AUTHORITATIVE for placement.`
        : `\nThe user indicates the photo was taken near ${formatCoords(user_coords.lat, user_coords.lon)}. Treat this as authoritative for placement.`;
    }

    // Fetch travelers from database (including uploaded reference headshots)
    const { data: travelers } = await supabase
      .from('trip_travelers')
      .select('name, description, role, reference_paths')
      .order('role', { ascending: true });  // crew first, then guests

    // Compress and resize image to fit under 5MB limit
    // Higher resolution and quality for better recognition.
    // failOn:'none' tolerates slightly-malformed JPEGs (e.g. stitched phone
    // panoramas) that would otherwise crash decoding and fail identification.
    const compressedBuffer = await sharp(imageBuffer, { failOn: 'none' })
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const base64 = compressedBuffer.toString('base64');
    console.log(`Image compressed: ${imageBuffer.length} -> ${compressedBuffer.length} bytes`);

    // Extract day number from context for location lookup
    const dayMatch = day_context.match(/Day (\d+)/);
    const dayNumber = dayMatch ? parseInt(dayMatch[1]) : null;
    const dayLocations = dayNumber ? DAY_LOCATIONS[dayNumber] : null;

    // Build location context
    let locationContext = '';
    if (dayLocations) {
      locationContext = `
Known locations for this day:
- Islands: ${dayLocations.islands.join(', ')}
- Landmarks: ${dayLocations.landmarks.join(', ')}
- Activities: ${dayLocations.activities.join(', ')}`;
    }

    // Build traveler context from database
    let travelerContext = '';
    if (travelers && travelers.length > 0) {
      const travelerList = travelers.map(t => {
        const parts = [t.name];
        if (t.role) parts.push(t.role);
        if (t.description) parts.push(t.description);
        return parts.length > 1 ? `${t.name} (${[t.role, t.description].filter(Boolean).join(', ')})` : t.name;
      }).join(', ');
      travelerContext = `\nPeople on this trip: ${travelerList}. If you recognize any of them in the photo, mention them by name.`;
    }

    // Gather labeled reference headshots to ground face matching. Capped to keep
    // token cost/latency bounded; if nobody has references, this is a no-op.
    const MAX_REFERENCE_IMAGES = 6;
    const referenceImages = [];
    for (const t of travelers || []) {
      if (referenceImages.length >= MAX_REFERENCE_IMAGES) break;
      const path = Array.isArray(t.reference_paths) ? t.reference_paths[0] : null;
      if (!path) continue;
      try {
        const { data: refData, error: refErr } = await supabase.storage.from('photos').download(path);
        if (refErr || !refData) continue;
        const refBuffer = Buffer.from(await refData.arrayBuffer());
        const refCompressed = await sharp(refBuffer, { failOn: 'none' })
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        referenceImages.push({ name: t.name, data: refCompressed.toString('base64') });
      } catch (refErr) {
        console.log(`Reference headshot skipped for ${t.name}:`, refErr.message);
      }
    }

    // Feedback loop: recent human-confirmed identifications, to stay consistent
    // with the names/places the group has already verified.
    let confirmedContext = '';
    const { data: verifiedPhotos } = await supabase
      .from('trip_photos')
      .select('title, location, people, description')
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(5);
    if (verifiedPhotos && verifiedPhotos.length > 0) {
      confirmedContext = `\n\nThe group has CONFIRMED these past identifications — match their names and place spellings:\n` +
        verifiedPhotos.map(p => {
          const ppl = Array.isArray(p.people) && p.people.length ? ` — people: ${p.people.join(', ')}` : '';
          return `- "${p.title}" at ${p.location}${ppl}`;
        }).join('\n');
    }

    // Build the message content: labeled reference faces first, then the photo
    // to identify, then the instruction.
    const content = [];
    if (referenceImages.length > 0) {
      content.push({ type: 'text', text: 'Labeled reference photos of people on this trip (match faces against these):' });
      for (const ref of referenceImages) {
        content.push({ type: 'text', text: `This is ${ref.name}:` });
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: ref.data } });
      }
    }
    content.push({ type: 'text', text: 'Photo to identify:' });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
    content.push({
      type: 'text',
      text: `You are a Corsica & Côte d'Azur travel expert helping identify photos from a trip (Cap Corse, Bonifacio, Nice).

This photo (the one labeled "Photo to identify") was taken on ${day_context}.${userContext}${gpsInfo}${locationContext}${travelerContext}${confirmedContext}

First identify what the photo ACTUALLY shows — the real subject, whether that's a landmark, building, food, plant, animal, object, or people. Then place it.

Guidance:
- If the user has provided a clarification or their own location above, treat it as the MOST authoritative signal — it overrides the GPS, the day's hints, and your own initial guess.
- If a GPS-derived location is given above, trust it as the camera's actual position and prefer it over the day's known-locations for placement (the subject may still be something seen from there).
- The known-locations and day context above are HINTS, not ground truth. Use them to help place real landmarks, but do NOT force the photo into one of those places when the subject is something else (a plant, an object, a dish). Identify the true subject even if it isn't a named place.
- Be specific when confident, and HONEST when not. If you can't determine the exact spot, give your best general placement and say so in the description rather than inventing a precise location — e.g. "a Cap Corse village (exact spot uncertain)" beats guessing a specific name. When uncertain, note the visual evidence or plausible alternatives in the description.
${referenceImages.length > 0 ? '- Match any faces against the labeled reference photos above; only name a person if you are reasonably confident, otherwise leave them out.' : ''}

Respond with ONLY a JSON object (no markdown):
{
  "title": "short descriptive name of the actual subject (include people's names if recognized)",
  "location": "best place/area; if the exact spot is uncertain, give the general area and flag the uncertainty",
  "description": "2-3 sentence vivid travel description; mention people by name if present; express uncertainty or alternatives when you are not sure",
  "tags": ["tag1","tag2","tag3"],
  "category": one of "landmark","food","seascape","wildlife","people","architecture","activity","beach",
  "people": ["names of recognized travelers; empty array if none"]
}`,
    });

    // Call Anthropic API with enriched context.
    // Use the strongest vision model + extended thinking so it reasons about the
    // image before committing to the JSON, rather than answering in one shot.
    // Opus 4.8 uses the adaptive-thinking API (thinking.type 'adaptive' +
    // output_config.effort); Sonnet 4.6 accepts the same form, so this works
    // whichever model ANTHROPIC_VISION_MODEL points at.
    const message = await anthropic.messages.create({
      model: ANTHROPIC_VISION_MODEL,
      // Generous cap: high-effort thinking tokens count toward max_tokens, so a
      // tight limit can truncate the JSON answer (which then fails to parse and
      // surfaces as "identification failed"). The JSON itself is small.
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      messages: [{ role: 'user', content }],
    });

    // Parse the response
    const responseText = message.content.find(b => b.type === 'text')?.text || '{}';
    const cleaned = responseText.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);

    // Update the photo record in the database
    const { error: updateError } = await supabase
      .from('trip_photos')
      .update({
        title: parsed.title || 'Untitled',
        location: parsed.location || 'Unknown location',
        description: parsed.description || '',
        tags: parsed.tags || [],
        category: parsed.category || 'landmark',
        people: Array.isArray(parsed.people) ? parsed.people : [],
        identified_at: new Date().toISOString(),
      })
      .eq('id', photo_id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Identification error:', error);
    return res.status(500).json({
      error: 'Identification failed',
      title: storage_path.split('/').pop()?.split('.')[0] || 'Photo',
      location: '—',
      description: 'AI identification failed. Tap to retry.',
      tags: [],
      category: 'landmark',
      people: [],
    });
  }
}
