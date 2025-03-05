// src/app/api/realtime/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function generateCompatibleAnswer(offer: RTCSessionDescriptionInit) {
  // Parse the offer SDP
  const offerSdp = offer.sdp;
  if (!offerSdp) {
    throw new Error('Offer SDP is required');
  }

  const sdpLines = offerSdp.split('\r\n');
  
  // Initialize answer SDP with session-level attributes
  let answerSdp = 'v=0\r\n' +
    'o=- ' + Date.now() + ' 2 IN IP4 127.0.0.1\r\n' +
    's=-\r\n' +
    't=0 0\r\n';

  let currentMedia = '';
  let mediaAttributes: string[] = [];
  let inMediaSection = false;
  let currentMid = '0';
  let currentPayloadTypes: string[] = [];

  // Process each line of the offer SDP
  for (let i = 0; i < sdpLines.length; i++) {
    const line = sdpLines[i];

    // Extract mid value from offer
    if (line.startsWith('a=mid:')) {
      currentMid = line.split(':')[1];
    }

    // Start of new media section
    if (line.startsWith('m=')) {
      if (currentMedia) {
        // Add the previous media section to answer
        answerSdp += currentMedia + '\r\n';
        mediaAttributes.forEach(attr => {
          answerSdp += attr + '\r\n';
        });
      }

      // Initialize new media section and extract payload types
      currentMedia = line;
      mediaAttributes = [];
      inMediaSection = true;
      // Extract payload types from m= line (e.g., "m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104")
      currentPayloadTypes = line.split(' ').slice(3);
      
      // Add required attributes for this media section
      mediaAttributes.push('c=IN IP4 0.0.0.0');
      mediaAttributes.push('a=rtcp:9 IN IP4 0.0.0.0');
      mediaAttributes.push('a=ice-ufrag:' + Math.random().toString(36).substr(2, 8));
      mediaAttributes.push('a=ice-pwd:' + Math.random().toString(36).substr(2, 24));
      mediaAttributes.push('a=ice-options:trickle');
      mediaAttributes.push('a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00');
      mediaAttributes.push('a=setup:active');
      mediaAttributes.push(`a=mid:${currentMid}`);
      mediaAttributes.push('a=sendrecv');
      mediaAttributes.push('a=rtcp-mux');
      continue;
    }

    // Copy relevant attributes from the offer
    if (inMediaSection) {
      // Copy all codec-related attributes
      if (line.startsWith('a=rtpmap:') ||
          line.startsWith('a=fmtp:') ||
          line.startsWith('a=rtcp-fb:')) {
        // Only include attributes for the payload types we support
        const payloadType = line.split(':')[1].split(' ')[0];
        if (currentPayloadTypes.includes(payloadType)) {
          mediaAttributes.push(line);
        }
      }
      // Copy extension maps
      else if (line.startsWith('a=extmap:')) {
        mediaAttributes.push(line);
      }
      // Copy ssrc attributes if present
      else if (line.startsWith('a=ssrc:')) {
        mediaAttributes.push(line);
      }
    }
  }

  // Add the last media section if exists
  if (currentMedia) {
    answerSdp += currentMedia + '\r\n';
    mediaAttributes.forEach(attr => {
      answerSdp += attr + '\r\n';
    });
  }

  // Log the generated answer SDP for debugging
  console.log('Generated Answer SDP:', answerSdp);
  console.log('Original Offer SDP:', offerSdp);

  return {
    type: 'answer' as const,
    sdp: answerSdp
  };
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body to get audio data and WebRTC offer
    const { offer, audioData } = await req.json();
    
    if (!offer) {
      return NextResponse.json(
        { error: 'WebRTC offer is required' },
        { status: 400 }
      );
    }

    // Generate compatible answer based on the offer
    const answer = generateCompatibleAnswer(offer);

    // If audio data is provided, transcribe it
    let transcription = null;
    if (audioData) {
      // Convert base64 audio data to Buffer if needed
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Create a File object from the buffer
      const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

      // Transcribe the audio using Whisper model
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });
    }

    // Return both WebRTC answer and transcription if available
    return NextResponse.json({
      answer,
      transcription: transcription?.text || null,
      sessionId: Date.now().toString() // Using timestamp as session ID for now
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    );
  }
}