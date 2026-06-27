import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { TRIP } from '../src/data/trip.js';
import { GUIDE } from '../src/data/guide.js';
import { PHOTO_ONLY_PLACEHOLDER } from '../src/lib/chatConstants.js';

// Helper to process attachments into Claude content blocks
async function processAttachments(attachments, supabase) {
  if (!attachments || attachments.length === 0) return { contentBlocks: [], failures: [] };

  const contentBlocks = [];
  const failures = [];

  for (const att of attachments) {
    try {
      // Only process images for now
      if (att.type?.startsWith('image/')) {
        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .download(att.storage_path);

        if (error) {
          console.error('Failed to download attachment:', error);
          failures.push({ name: att.name, reason: 'download failed' });
          continue;
        }

        const arrayBuffer = await data.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Compress and resize to fit under 5MB limit
        // Use higher resolution and quality for better recognition
        const compressedBuffer = await sharp(imageBuffer)
          .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();

        const base64 = compressedBuffer.toString('base64');
        console.log(`Chat image compressed: ${imageBuffer.length} -> ${compressedBuffer.length} bytes`);

        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64,
          },
        });
      } else {
        // Track unsupported types
        failures.push({ name: att.name, reason: 'type not yet supported' });
      }
    } catch (err) {
      console.error('Error processing attachment:', err);
      failures.push({ name: att.name, reason: 'processing error' });
    }
  }

  return { contentBlocks, failures };
}

function getCurrentDay() {
  const now = new Date();
  const start = new Date(TRIP.startDate);
  const diffTime = now - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { dayNumber: 0, description: `Trip starts in ${-diffDays} days` };
  if (diffDays >= TRIP.days.length) return { dayNumber: TRIP.days.length, description: 'Trip has ended' };

  const day = TRIP.days[diffDays];
  return {
    dayNumber: day.n,
    description: `Day ${day.n} (${day.date}) — ${day.title}: ${day.route}`,
  };
}

function buildSystemPrompt(context) {
  const { currentDay, photos, notes, travelers, itinerary } = context;

  let photoSummary = 'No photos uploaded yet.';
  if (photos && photos.length > 0) {
    photoSummary = photos.map(p =>
      `- "${p.title}" at ${p.location}: ${p.description}`
    ).join('\n');
  }

  let notesSummary = 'No journal notes yet.';
  if (notes && notes.length > 0) {
    notesSummary = notes.map(n =>
      `- Day ${n.day_number}: "${n.body.slice(0, 100)}${n.body.length > 100 ? '...' : ''}"`
    ).join('\n');
  }

  let travelersSummary = 'No travelers registered yet.';
  if (travelers && travelers.length > 0) {
    travelersSummary = travelers.map(t => {
      const parts = [t.name];
      if (t.role) parts.push(`(${t.role})`);
      if (t.description) parts.push(`- ${t.description}`);
      return parts.join(' ');
    }).join('\n');
  }

  let itinerarySummary = TRIP.days.map(d =>
    `Day ${d.n} (${d.date}): ${d.title} — ${d.route}`
  ).join('\n');

  return `${GUIDE.knowledge}

=== CURRENT TRIP STATUS ===
Today: ${currentDay.description}
Trip dates: ${TRIP.dates}

ITINERARY:
${itinerarySummary}

PHOTOS THE GROUP HAS TAKEN:
${photoSummary}

RECENT JOURNAL NOTES:
${notesSummary}

=== PEOPLE ON THIS TRIP ===
${travelersSummary}

${GUIDE.instructions}`;
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

  const { message, attachments } = req.body;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  // Validate: require either text or at least one attachment (photo-only is allowed)
  const trimmedMessage = (typeof message === 'string' ? message : '').trim();
  if (!trimmedMessage && !hasAttachments) {
    return res.status(400).json({ error: 'Message or attachment required' });
  }
  if (trimmedMessage.length > 4000) {
    return res.status(400).json({ error: 'Message too long (max 4000 characters)' });
  }

  try {
    // Fetch context data in parallel
    const [photosResult, notesResult, chatHistoryResult, travelersResult] = await Promise.all([
      // Get all photos with descriptions
      supabase
        .from('trip_photos')
        .select('title, location, description, day_number, category')
        .not('identified_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50),

      // Get recent notes
      supabase
        .from('trip_notes')
        .select('day_number, body, created_at')
        .order('created_at', { ascending: false })
        .limit(20),

      // Get recent chat history
      supabase
        .from('trip_chat')
        .select('role, content, created_at')
        .order('created_at', { ascending: false })
        .limit(20),

      // Get travelers
      supabase
        .from('trip_travelers')
        .select('id, name, role, description')
        .order('role', { ascending: true }),
    ]);

    const photos = photosResult.data || [];
    const notes = notesResult.data || [];
    const chatHistory = (chatHistoryResult.data || []).reverse(); // Oldest first
    const travelers = travelersResult.data || [];

    // Build context
    const currentDay = getCurrentDay();
    const systemPrompt = buildSystemPrompt({
      currentDay,
      photos,
      notes,
      travelers,
      itinerary: TRIP.days,
    });

    // Build messages array with history
    const messages = [];
    for (const msg of chatHistory) {
      // Skip empty-content rows — the Anthropic API rejects empty content blocks,
      // and a single empty row would otherwise break every subsequent request.
      if (!msg.content || !msg.content.trim()) continue;
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
    // The API requires the first message to be from the user.
    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
    }

    // Process any attachments (images, etc.)
    const { contentBlocks: attachmentBlocks, failures: attachmentFailures } = await processAttachments(attachments, supabase);

    // Build user message content (text + any images)
    let userContent;
    // When a photo is sent with no caption, give Léa an explicit instruction
    // so he identifies and comments on it (and never send an empty text block).
    const PHOTO_ONLY_PROMPT = 'I shared a photo without a caption. Identify what it shows — landmarks, food, people, or places — and comment on it as Léa, my local guide.';
    let messageWithFailures = trimmedMessage || PHOTO_ONLY_PROMPT;

    // If some attachments failed, note that in the message context
    if (attachmentFailures.length > 0) {
      const failureNote = `\n[Note: ${attachmentFailures.length} attachment(s) could not be processed]`;
      console.log('Attachment failures:', attachmentFailures);
      messageWithFailures += failureNote;
    }

    if (attachmentBlocks.length > 0) {
      // Multi-part message with images and text
      userContent = [
        ...attachmentBlocks,
        { type: 'text', text: messageWithFailures },
      ];
    } else {
      userContent = messageWithFailures;
    }

    // Add the new user message
    messages.push({
      role: 'user',
      content: userContent,
    });

    // Store user message first
    const { data: userMsgData, error: userMsgError } = await supabase
      .from('trip_chat')
      .insert({
        role: 'user',
        author_email: user.email,
        // Store a placeholder (not empty) for photo-only sends so chat history
        // never feeds an empty content block into future prompts. Shared constant
        // keeps it in sync with the client so realtime de-dup reconciles.
        content: trimmedMessage || PHOTO_ONLY_PLACEHOLDER,
        attachments: attachments || null,
      })
      .select()
      .single();

    if (userMsgError) {
      console.error('Error storing user message:', userMsgError);
    }

    // Define tools for managing travelers
    const tools = [
      {
        name: 'add_traveler',
        description: 'Add a new person (guest or crew) to the trip. Use this when someone asks to add a person to the travelers list.',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The person\'s name' },
            role: { type: 'string', description: 'Their role: guest, crew, captain, chef, etc.' },
            description: { type: 'string', description: 'Physical description or identifying features (hair color, height, usual clothing, etc.)' },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_traveler',
        description: 'Update an existing traveler\'s information. Use this to change their description or role.',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The person\'s name to find and update' },
            role: { type: 'string', description: 'Updated role (optional)' },
            description: { type: 'string', description: 'Updated description (optional)' },
          },
          required: ['name'],
        },
      },
      {
        name: 'remove_traveler',
        description: 'Remove a person from the travelers list.',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The person\'s name to remove' },
          },
          required: ['name'],
        },
      },
      {
        name: 'list_travelers',
        description: 'List all current travelers and crew. Use when someone asks who is on the trip.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ];

    // Call Claude API with tools
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
      tools: tools,
    });

    // Handle tool use if Claude wants to manage travelers
    let assistantMessage = '';
    let toolRounds = 0;
    const MAX_TOOL_ROUNDS = 5; // guard against an unbounded tool-use loop
    while (response.stop_reason === 'tool_use' && toolRounds < MAX_TOOL_ROUNDS) {
      toolRounds++;
      const toolUseBlock = response.content.find(b => b.type === 'tool_use');
      if (!toolUseBlock) break;

      let toolResult = '';

      try {
        if (toolUseBlock.name === 'add_traveler') {
          const { name, role, description } = toolUseBlock.input;
          if (!name || !name.trim()) {
            toolResult = 'Error: a name is required to add a traveler.';
          } else {
            const { error } = await supabase
              .from('trip_travelers')
              .insert({ name: name.trim(), role: role || 'guest', description: description || null });
            toolResult = error ? `Error: ${error.message}` : `Added ${name.trim()} to the trip!`;
          }
        }
        else if (toolUseBlock.name === 'update_traveler') {
          const { name, role, description } = toolUseBlock.input;
          const updates = {};
          if (role !== undefined) updates.role = role;
          if (description !== undefined) updates.description = description;
          updates.updated_at = new Date().toISOString();

          const { error } = await supabase
            .from('trip_travelers')
            .update(updates)
            .ilike('name', name);
          toolResult = error ? `Error: ${error.message}` : `Updated ${name}'s information.`;
        }
        else if (toolUseBlock.name === 'remove_traveler') {
          const { name } = toolUseBlock.input;
          const { error } = await supabase
            .from('trip_travelers')
            .delete()
            .ilike('name', name);
          toolResult = error ? `Error: ${error.message}` : `Removed ${name} from the trip.`;
        }
        else if (toolUseBlock.name === 'list_travelers') {
          const { data } = await supabase
            .from('trip_travelers')
            .select('name, role, description')
            .order('role', { ascending: true });
          if (data && data.length > 0) {
            toolResult = data.map(t => {
              const parts = [`${t.name} (${t.role || 'guest'})`];
              if (t.description) parts.push(`: ${t.description}`);
              return parts.join('');
            }).join('\n');
          } else {
            toolResult = 'No travelers registered yet.';
          }
        }
      } catch (err) {
        toolResult = `Error: ${err.message}`;
      }

      // Add the assistant's tool use and the result to messages
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult }],
      });

      // Continue the conversation
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
        tools: tools,
      });
    }

    // Get the final text response. Never empty — an empty string would be
    // rejected by the API when replayed as history on the next turn.
    assistantMessage = response.content.find(b => b.type === 'text')?.text || '';
    if (!assistantMessage.trim()) {
      assistantMessage = "Mi dispiace — I didn't quite catch that. Could you try rephrasing?";
    }

    // Store assistant response
    const { data: assistantMsgData, error: assistantMsgError } = await supabase
      .from('trip_chat')
      .insert({
        role: 'assistant',
        author_email: null,
        content: assistantMessage,
        attachments: null,
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error('Error storing assistant message:', assistantMsgError);
    }

    return res.status(200).json({
      response: assistantMessage,
      message_id: assistantMsgData?.id,
      attachment_failures: attachmentFailures.length > 0 ? attachmentFailures : undefined,
    });

  } catch (error) {
    console.error('Chat error:', error);

    // Handle specific error types
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Léa is busy right now. Please try again in a moment.',
      });
    }

    if (error.status === 401 || error.status === 403) {
      return res.status(500).json({
        error: 'Configuration error. Please contact support.',
      });
    }

    return res.status(500).json({
      error: 'Failed to get response from Léa. Please try again.',
    });
  }
}
