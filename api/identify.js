import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { DAY_LOCATIONS } from '../src/data/locations.js';

// Try to import exifr - it may not work in all serverless environments
let exifr = null;
try {
  exifr = await import('exifr');
} catch (e) {
  console.log('exifr not available, GPS extraction disabled');
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

  const { photo_id, storage_path, day_context } = req.body;

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

    // Extract EXIF data including GPS coordinates (if exifr is available)
    let gpsInfo = '';
    if (exifr) {
      try {
        const exifData = await exifr.parse(imageBuffer, {
          gps: true,
          pick: ['latitude', 'longitude', 'DateTimeOriginal', 'Make', 'Model'],
        });
        if (exifData?.latitude && exifData?.longitude) {
          gpsInfo = `\nGPS coordinates: ${exifData.latitude.toFixed(4)}°N, ${exifData.longitude.toFixed(4)}°E`;
          console.log(`Photo GPS: ${exifData.latitude}, ${exifData.longitude}`);
        }
      } catch (exifErr) {
        console.log('No EXIF data available:', exifErr.message);
      }
    }

    // Fetch travelers from database (including uploaded reference headshots)
    const { data: travelers } = await supabase
      .from('trip_travelers')
      .select('name, description, role, reference_paths')
      .order('role', { ascending: true });  // crew first, then guests

    // Compress and resize image to fit under 5MB limit
    // Higher resolution and quality for better recognition
    const compressedBuffer = await sharp(imageBuffer)
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
        const refCompressed = await sharp(refBuffer)
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
      text: `You are a Corsica & Côte d'Azur travel expert helping identify photos from a Corsica & Côte d'Azur trip (Cap Corse, Bonifacio, Nice).

This photo (the one labeled "Photo to identify") was taken on ${day_context}.${gpsInfo}${locationContext}${travelerContext}${confirmedContext}

Identify the location, landmarks, food, or people in the photo to identify. Be specific - use the known locations list to help identify places. ${referenceImages.length > 0 ? 'Match any faces against the labeled reference photos above; only name a person if you are reasonably confident, otherwise leave them out.' : ''}

Respond with ONLY a JSON object (no markdown):
{
  "title": "short descriptive name (include people's names if recognized)",
  "location": "specific place / landmark identified",
  "description": "2-3 sentence vivid travel description mentioning people by name if present",
  "tags": ["tag1","tag2","tag3"],
  "category": one of "landmark","food","seascape","wildlife","people","architecture","activity","beach",
  "people": ["names of recognized travelers; empty array if none"]
}`,
    });

    // Call Anthropic API with enriched context
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
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
