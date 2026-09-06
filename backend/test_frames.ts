import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

function renderTestFrames() {
  const width = 720;
  const height = 1280;
  const outputDir = path.join(process.cwd(), 'diagnostic_frames');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const branding = {
    url: 'https://supabase.com',
    title: 'Supabase | The Postgres Development Platform',
    description: 'Build production-grade applications with a Postgres database, Authentication, instant APIs, Realtime, Functions, Storage and Vector embeddings.',
    primaryColor: '#3ECF8E',
    accentColor: '#10B981',
  };

  const storyboard = {
    hook: 'Stop wasting hours building complex backends. Meet Supabase!',
    scenes: [
      { id: 1, durationSec: 6, caption: 'STOP WASTING HOURS! ⚡', narrationText: 'Meet Supabase', assetType: 'brand_card' as const, motionEffect: 'zoom_in' as const },
      { id: 2, durationSec: 6, caption: 'TIRED OF SLOW SETUP? 🛑', narrationText: 'Traditional setups take weeks', assetType: 'brand_card' as const, motionEffect: 'tilt_3d' as const },
      { id: 3, durationSec: 6, caption: 'INSTANT POSTGRES + AUTH + APIS 🚀', narrationText: 'Realtime database in seconds', assetType: 'brand_card' as const, motionEffect: 'pan_down' as const },
      { id: 4, durationSec: 7, caption: 'START FREE TODAY AT SUPABASE.COM! 🔗', narrationText: 'Try Supabase today', assetType: 'brand_card' as const, motionEffect: 'zoom_in' as const },
    ],
  };

  const domain = 'SUPABASE.COM';

  for (let sceneIndex = 0; sceneIndex < 4; sceneIndex++) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Sleek Gradient Dark Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090D16');
    bgGrad.addColorStop(0.5, '#0E1322');
    bgGrad.addColorStop(1, '#070A10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Radiant Accent Glow behind cards
    const glow = ctx.createRadialGradient(width / 2, height * 0.35, 20, width / 2, height * 0.35, width * 0.6);
    glow.addColorStop(0, branding.primaryColor + '33');
    glow.addColorStop(1, '#00000000');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // 3. Top Browser / Brand Pill
    const pillY = 50;
    const pillW = width - 100;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.roundRect(50, pillY, pillW, 60, 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Browser dots
    ctx.fillStyle = '#EF4444';
    ctx.beginPath(); ctx.arc(80, pillY + 30, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath(); ctx.arc(100, pillY + 30, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10B981';
    ctx.beginPath(); ctx.arc(120, pillY + 30, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🌐  ${domain}`, width / 2 + 20, pillY + 38);

    // 4. SCENE-SPECIFIC VISUAL CARDS
    if (sceneIndex === 0) {
      // SCENE 1: HOOK & HERO
      // Badge
      ctx.fillStyle = branding.primaryColor + '25';
      ctx.roundRect(width / 2 - 120, 160, 240, 44, 22);
      ctx.fill();
      ctx.strokeStyle = branding.primaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = branding.primaryColor;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('⚡ AI PRODUCT SPOTLIGHT', width / 2, 188);

      // Main Hook Headline
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 38px sans-serif';
      drawWrappedText(ctx, storyboard.scenes[0].caption || storyboard.hook, width / 2, 260, width - 120, 48);

      // Hero Product Card
      const cardY = 460;
      const cardH = 580;
      ctx.fillStyle = '#131826';
      ctx.roundRect(40, cardY, width - 80, cardH, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Brand Title Inside Card
      ctx.fillStyle = branding.primaryColor;
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(branding.title.slice(0, 28), width / 2, cardY + 70);

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(80, cardY + 110);
      ctx.lineTo(width - 80, cardY + 110);
      ctx.stroke();

      // Description text
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '22px sans-serif';
      drawWrappedText(ctx, branding.description, width / 2, cardY + 160, width - 140, 36);

      // Trust Badge at bottom of card
      ctx.fillStyle = 'rgba(62, 207, 142, 0.15)';
      ctx.roundRect(80, cardY + cardH - 90, width - 160, 56, 16);
      ctx.fill();
      ctx.fillStyle = '#3ECF8E';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('⭐ 100% Free & Open Source Alternative', width / 2, cardY + cardH - 54);

    } else if (sceneIndex === 1) {
      // SCENE 2: THE PROBLEM
      ctx.fillStyle = '#EF444425';
      ctx.roundRect(width / 2 - 110, 160, 220, 44, 22);
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('🛑 THE PROBLEM', width / 2, 188);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 38px sans-serif';
      drawWrappedText(ctx, storyboard.scenes[1].caption, width / 2, 260, width - 120, 48);

      // 3 Problem Pain Point Cards
      const problems = [
        { icon: '⏳', title: 'Slow & Tedious Setup', desc: 'Manual configuration delays product launches by weeks.' },
        { icon: '💸', title: 'Skyrocketing Cloud Bills', desc: 'Hidden database costs and proprietary lock-in.' },
        { icon: '🧩', title: 'Fragmented Tools', desc: 'Stitching separate auth, storage, and APIs together.' },
      ];

      problems.forEach((p, idx) => {
        const pY = 460 + idx * 210;
        ctx.fillStyle = '#16131B';
        ctx.roundRect(40, pY, width - 80, 180, 24);
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '36px sans-serif';
        ctx.fillText(p.icon, 90, pY + 60);

        ctx.fillStyle = '#FCA5A5';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(p.title, 140, pY + 55);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '19px sans-serif';
        drawWrappedTextLeft(ctx, p.desc, 140, pY + 95, width - 210, 28);
        ctx.textAlign = 'center';
      });

    } else if (sceneIndex === 2) {
      // SCENE 3: SOLUTION & FEATURES
      ctx.fillStyle = '#10B98125';
      ctx.roundRect(width / 2 - 130, 160, 260, 44, 22);
      ctx.fill();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('🚀 SUPERPOWER FEATURES', width / 2, 188);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      drawWrappedText(ctx, storyboard.scenes[2].caption, width / 2, 260, width - 120, 46);

      // 3 Feature Cards
      const features = [
        { icon: '⚡', title: 'Postgres Database', desc: 'Dedicated enterprise Postgres with full SQL power & extensions.' },
        { icon: '🔒', title: 'Authentication & APIs', desc: 'Instant Row Level Security, OAuth logins, and auto REST APIs.' },
        { icon: '📡', title: 'Realtime & Edge Functions', desc: 'Listen to database changes in milliseconds worldwide.' },
      ];

      features.forEach((f, idx) => {
        const fY = 460 + idx * 210;
        ctx.fillStyle = '#111D1E';
        ctx.roundRect(40, fY, width - 80, 180, 24);
        ctx.fill();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '36px sans-serif';
        ctx.fillText(f.icon, 90, fY + 60);

        ctx.fillStyle = '#6EE7B7';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(f.title, 140, fY + 55);

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '19px sans-serif';
        drawWrappedTextLeft(ctx, f.desc, 140, fY + 95, width - 210, 28);
        ctx.textAlign = 'center';
      });

    } else {
      // SCENE 4: CALL TO ACTION
      ctx.fillStyle = branding.primaryColor + '25';
      ctx.roundRect(width / 2 - 110, 180, 220, 44, 22);
      ctx.fill();
      ctx.strokeStyle = branding.primaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = branding.primaryColor;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('🎯 READY TO BUILD?', width / 2, 208);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 40px sans-serif';
      drawWrappedText(ctx, `Level Up With ${domain}`, width / 2, 300, width - 120, 52);

      // Showcase Container Card
      const cardY = 480;
      ctx.fillStyle = '#131826';
      ctx.roundRect(40, cardY, width - 80, 420, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('Start Building In Under 2 Minutes', width / 2, cardY + 70);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '20px sans-serif';
      ctx.fillText('No credit card required • Free tier included', width / 2, cardY + 120);

      // Giant CTA Button
      const btnY = cardY + 200;
      const btnGrad = ctx.createLinearGradient(60, btnY, width - 60, btnY);
      btnGrad.addColorStop(0, '#3ECF8E');
      btnGrad.addColorStop(1, '#06B6D4');
      ctx.fillStyle = btnGrad;
      ctx.roundRect(70, btnY, width - 140, 90, 45);
      ctx.fill();

      ctx.fillStyle = '#090D16';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('🚀  Get Started Free →', width / 2, btnY + 56);

      // Outro Link
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`Visit: ${branding.url}`, width / 2, height - 120);
    }

    const frameFile = path.join(outputDir, `scene_${sceneIndex + 1}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(frameFile, buffer);
    console.log(`Rendered frame ${sceneIndex + 1}: ${frameFile} (${buffer.length} bytes)`);
  }
}

function drawWrappedText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = (text || '').split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

function drawWrappedTextLeft(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = (text || '').split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

renderTestFrames();
