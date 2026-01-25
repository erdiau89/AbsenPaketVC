
import React, { useRef, useState, useCallback, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  locationLabel: string;
  timeLabel: string;
  dateLabel: string;
  dayLabel: string;
  gpsCode: string;
  shiftLabel: string;
  keteranganLabel: string;
  studentName: string;
  selectedKelas: string;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ 
  onCapture, 
  onClose,
  locationLabel, 
  timeLabel, 
  dateLabel, 
  dayLabel, 
  gpsCode,
  shiftLabel,
  keteranganLabel,
  studentName,
  selectedKelas
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [timerDuration, setTimerDuration] = useState<0 | 3 | 5 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const startCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Izin Kamera Ditolak.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  const drawWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Skala watermark disesuaikan dengan lebar baru (800px)
    const scale = width / 800;
    
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetX = 3 * scale;
    ctx.shadowOffsetY = 3 * scale;

    const grad = ctx.createLinearGradient(0, height, 0, height - 350 * scale);
    grad.addColorStop(0, 'rgba(0,0,0,0.8)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, height - 350 * scale, width, 350 * scale);

    // KIRI ATAS
    ctx.textAlign = 'left';
    ctx.fillStyle = '#facc15';
    ctx.font = `bold ${32 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(studentName.toUpperCase(), 40 * scale, 60 * scale);

    ctx.fillStyle = 'white';
    ctx.font = `italic 600 ${18 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(`"${shiftLabel} - ${selectedKelas}"`, 40 * scale, 90 * scale);

    // KANAN ATAS
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.font = `bold ${18 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText("E-Absensi Digital ERDI", width - 40 * scale, 55 * scale);
    ctx.font = `500 ${14 * scale}px "Plus Jakarta Sans"`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText("Verified System", width - 40 * scale, 75 * scale);

    // BAGIAN BAWAH
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    
    // Jam
    ctx.font = `bold ${120 * scale}px "Plus Jakarta Sans"`;
    const timeWidth = ctx.measureText(timeLabel).width;
    const clockY = height - 110 * scale;
    ctx.fillText(timeLabel, 40 * scale, clockY);

    // Garis Oranye
    const lineX = 40 * scale + timeWidth + 25 * scale;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(lineX, clockY - 85 * scale);
    ctx.lineTo(lineX, clockY + 5 * scale);
    ctx.stroke();

    // Tanggal
    ctx.fillStyle = 'white';
    ctx.font = `bold ${28 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(dateLabel, lineX + 25 * scale, clockY - 50 * scale);
    ctx.font = `500 ${28 * scale}px "Plus Jakarta Sans"`;
    ctx.fillText(dayLabel, lineX + 25 * scale, clockY - 10 * scale);

    // Alamat (Ukuran Font diperkecil untuk hemat ruang visual)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `500 ${22 * scale}px "Plus Jakarta Sans"`;
    const fullLoc = locationLabel;
    const maxWidth = width - 80 * scale;
    const words = fullLoc.split(' ');
    let currentLine = '';
    let addressY = height - 70 * scale;
    
    for(let n = 0; n < words.length; n++) {
      let testLine = currentLine + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(currentLine, 40 * scale, addressY);
        currentLine = words[n] + ' ';
        addressY += 30 * scale;
      } else {
        currentLine = testLine;
      }
    }
    ctx.fillText(currentLine, 40 * scale, addressY);

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `500 ${12 * scale}px "JetBrains Mono"`;
    ctx.fillText(`GPS: ${gpsCode}`, 40 * scale, height - 25 * scale);
  };

  const doCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // OPTIMASI: Turunkan ke 800px (Sangat cukup untuk verifikasi)
        const targetWidth = 800;
        const aspectRatio = video.videoHeight / video.videoWidth;
        const targetHeight = targetWidth * aspectRatio;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        drawWatermark(ctx, canvas.width, canvas.height);
        
        // OPTIMASI: Kualitas 0.6 (Sangat hemat namun tetap layak)
        onCapture(canvas.toDataURL('image/jpeg', 0.6));
      }
    }
  }, [facingMode, onCapture, timeLabel, dateLabel, dayLabel, locationLabel, gpsCode, studentName, shiftLabel, selectedKelas]);

  const handleCaptureClick = () => {
    if (countdown !== null) return;
    if (timerDuration > 0) {
      setCountdown(timerDuration);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            doCapture();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      doCapture();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-in fade-in duration-500">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
      />
      
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-[110]">
          <span className="text-white text-[12rem] font-black animate-[ping_1s_infinite] drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
            {countdown}
          </span>
        </div>
      )}
      
      <div className="absolute top-10 left-8 right-8 flex justify-between items-start">
        <button onClick={onClose} className="p-4 glass-morphism rounded-full text-white active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-right">
          <div className="flex items-center justify-end space-x-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white">Cloud Camera Ready</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex justify-between items-center px-12">
        <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="w-14 h-14 glass-morphism rounded-full text-white flex items-center justify-center active:scale-90 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
          </svg>
        </button>
        
        <button
          onClick={handleCaptureClick}
          className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-1.5 shadow-[0_0_50px_rgba(255,255,255,0.4)] active:scale-95 transition-transform"
        >
          <div className="w-full h-full border-[6px] border-slate-200 rounded-full bg-white flex items-center justify-center">
            {countdown ? (
               <span className="text-slate-900 font-black text-2xl mono">{countdown}</span>
            ) : (
               <div className="w-1/2 h-1/2 bg-indigo-600 rounded-full"></div>
            )}
          </div>
        </button>

        <button 
          onClick={() => setTimerDuration(t => t === 0 ? 3 : t === 3 ? 5 : 0)}
          className={`w-14 h-14 glass-morphism rounded-full flex flex-col items-center justify-center active:scale-90 transition-all border ${timerDuration > 0 ? 'border-yellow-400 text-yellow-400' : 'border-white/10 text-white'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
          </svg>
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCapture;
