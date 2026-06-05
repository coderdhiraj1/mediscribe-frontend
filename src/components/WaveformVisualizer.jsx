import React, { useEffect, useRef } from 'react';

export default function WaveformVisualizer({ stream, isRecording }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution for crisp rendering on high-DPI screens
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();

    // If not recording, draw a sleek flat line and exit
    if (!isRecording || !stream) {
      const drawIdle = () => {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        const isLightTheme = document.documentElement.classList.contains('light-theme');
        ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      };
      
      drawIdle();
      
      // Cleanup previous context if any
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
      return;
    }

    // Initialize Web Audio API
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, width, height);

        // Center line
        const centerY = height / 2;

        // Draw multiple layered waves for a premium glowing 3D aesthetic
        // Wave 1: Teal Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(45, 212, 191, 0.6)';
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();

        let sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          // Normalize value to a percentage
          const v = dataArray[i] / 128.0;
          const y = centerY + (v - 1.0) * (height / 2.5);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            // Smooth curve
            const xc = x + sliceWidth / 2;
            const yc = centerY + (dataArray[i - 1] / 128.0 - 1.0) * (height / 2.5);
            ctx.quadraticCurveTo(x - sliceWidth / 2, yc, xc, y);
          }

          x += sliceWidth;
        }
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Wave 2: Purple Glow (offset to create depth)
        ctx.shadowColor = 'rgba(167, 139, 250, 0.6)';
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        x = 0;

        for (let i = 0; i < bufferLength; i++) {
          // Add phase shift for the second wave
          const index = (i + 4) % bufferLength;
          const v = dataArray[index] / 128.0;
          const y = centerY - (v - 1.0) * (height / 3);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const xc = x + sliceWidth / 2;
            const yc = centerY - (dataArray[(index - 1 + bufferLength) % bufferLength] / 128.0 - 1.0) * (height / 3);
            ctx.quadraticCurveTo(x - sliceWidth / 2, yc, xc, y);
          }
          x += sliceWidth;
        }
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Reset shadows for performance
        ctx.shadowBlur = 0;
      };

      draw();
    } catch (e) {
      console.error('Failed to initialize waveform visualizer', e);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [stream, isRecording]);

  return (
    <div className="waveform-container">
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
}
