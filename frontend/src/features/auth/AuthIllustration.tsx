export default function AuthIllustration() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 520,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: '#FFFFFF',
        padding: '1.5rem',
      }}
    >
      <style>{`
        @keyframes planeFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(4deg); }
        }
        @keyframes starPulse {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-8px) scale(1.1); }
        }
        @keyframes mailFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }
        @keyframes bubbleBob {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-9px) scale(1.05); }
        }
        @keyframes gearRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .animate-plane {
          animation: planeFloat 3.5s ease-in-out infinite;
        }
        .animate-star {
          animation: starPulse 2.8s ease-in-out infinite;
        }
        .animate-mail {
          animation: mailFloat 4s ease-in-out infinite;
        }
        .animate-bubble {
          animation: bubbleBob 3.2s ease-in-out infinite;
        }
        .animate-gear {
          animation: gearRotate 15s linear infinite;
        }
      `}</style>

      {/* Main Illustration SVG Frame */}
      <svg
        viewBox="0 0 700 580"
        style={{ width: '100%', maxHeight: 540, overflow: 'visible' }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background Arc */}
        <path
          d="M 100 480 A 260 260 0 0 1 600 480"
          fill="#F4F5F7"
          opacity="0.6"
        />

        {/* 1. Animated Floating Doodles Around Illustration */}

        {/* Aeroplane (Green Paper Plane - Top Right) */}
        <g className="animate-plane" style={{ transformOrigin: '480px 150px' }}>
          <path
            d="M 460 160 L 510 130 L 485 180 L 475 165 L 460 160 Z M 485 180 L 495 152"
            stroke="#2E7D32"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* Star (Yellow Four-Point Star - Top Right Above Plane) */}
        <g className="animate-star" style={{ transformOrigin: '580px 100px' }}>
          <path
            d="M 580 90 Q 580 100 590 100 Q 580 100 580 110 Q 580 100 570 100 Q 580 100 580 90 Z"
            fill="#F59E0B"
            stroke="#D97706"
            strokeWidth="2"
          />
        </g>

        {/* Mail Envelope Icon (Blue with arrow - Top Left) */}
        <g className="animate-mail" style={{ transformOrigin: '90px 180px' }}>
          <rect x="70" y="165" width="45" height="32" rx="4" stroke="#1D4ED8" strokeWidth="3" fill="#FFFFFF" />
          <path d="M 70 170 L 92 185 L 115 170" stroke="#1D4ED8" strokeWidth="3" fill="none" />
          <path d="M 55 175 L 70 175 M 50 182 L 65 182" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Speech Bubble Icon (Yellow - Middle Left) */}
        <g className="animate-bubble" style={{ transformOrigin: '80px 290px' }}>
          <path
            d="M 70 280 C 60 280 55 288 55 298 C 55 308 65 315 78 315 L 75 325 L 88 315 C 98 315 105 308 105 298 C 105 288 95 280 70 280 Z"
            fill="#FEF3C7"
            stroke="#D97706"
            strokeWidth="3"
          />
        </g>

        {/* Gear Icon (Gray - Middle Right) */}
        <g className="animate-gear" style={{ transformOrigin: '630px 290px' }}>
          <circle cx="630" cy="290" r="14" stroke="#94A3B8" strokeWidth="3" strokeDasharray="6 4" fill="none" />
          <circle cx="630" cy="290" r="5" fill="#94A3B8" />
        </g>

        {/* Top Left Doodle Wave Lines */}
        <path d="M 60 50 Q 75 40 90 50 Q 105 60 120 50" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Outer Rectangular Border Frame */}
        <rect x="35" y="160" width="630" height="370" rx="8" stroke="#714B67" strokeWidth="2.5" strokeOpacity="0.4" fill="none" />
        <rect x="25" y="150" width="650" height="390" rx="10" stroke="#E2E8F0" strokeWidth="1.5" fill="none" />

        {/* 2. Central Kanban Board on Wall */}
        <g>
          {/* Main Board Header Frame */}
          <rect x="210" y="200" width="280" height="120" rx="6" fill="#FFFFFF" stroke="#714B67" strokeWidth="3" />
          <line x1="210" y1="230" x2="490" y2="230" stroke="#714B67" strokeWidth="2" />
          <line x1="303" y1="200" x2="303" y2="320" stroke="#714B67" strokeWidth="1.5" />
          <line x1="396" y1="200" x2="396" y2="320" stroke="#714B67" strokeWidth="1.5" />

          {/* Column Headers */}
          <rect x="220" y="208" width="70" height="15" rx="3" fill="#714B67" />
          <text x="255" y="219" fill="#FFF" fontSize="9" fontWeight="700" textAnchor="middle">TO DO</text>

          <rect x="313" y="208" width="70" height="15" rx="3" fill="#714B67" />
          <text x="348" y="219" fill="#FFF" fontSize="9" fontWeight="700" textAnchor="middle">IN PROGRESS</text>

          <rect x="406" y="208" width="70" height="15" rx="3" fill="#714B67" />
          <text x="441" y="219" fill="#FFF" fontSize="9" fontWeight="700" textAnchor="middle">DONE</text>

          {/* Sticky Notes on Kanban Board */}
          {/* TO DO Sticky Notes */}
          <rect x="225" y="238" width="25" height="12" fill="#FBBF24" rx="2" />
          <rect x="255" y="238" width="35" height="12" fill="#FCD34D" rx="2" />
          <rect x="225" y="258" width="45" height="12" fill="#FBBF24" rx="2" />
          <rect x="225" y="280" width="20" height="20" fill="#FCD34D" rx="2" />

          {/* IN PROGRESS Sticky Notes */}
          <rect x="318" y="238" width="25" height="12" fill="#FBBF24" rx="2" />
          <rect x="348" y="238" width="35" height="12" fill="#0D9488" rx="2" />
          <rect x="318" y="258" width="30" height="30" fill="#FCD34D" rx="2" />

          {/* DONE Sticky Notes */}
          <rect x="411" y="238" width="20" height="25" fill="#FBBF24" rx="2" />
          <rect x="436" y="238" width="30" height="25" fill="#0D9488" rx="2" />
          <rect x="411" y="270" width="35" height="15" fill="#FCD34D" rx="2" />
        </g>

        {/* 3. Desk & Workers Scene */}

        {/* Desk Table */}
        <rect x="120" y="440" width="460" height="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" rx="4" />
        <rect x="150" y="456" width="16" height="50" fill="#E2E8F0" />
        <rect x="534" y="456" width="16" height="50" fill="#E2E8F0" />

        {/* Plant in Red Pot in Desk Center */}
        <g>
          <path d="M 335 440 L 340 405 L 360 405 L 365 440 Z" fill="#EF4444" />
          {/* Leaves */}
          <path d="M 350 405 Q 330 360 345 320 Q 355 365 350 405 Z" fill="#10B981" />
          <path d="M 350 405 Q 370 370 365 330 Q 355 375 350 405 Z" fill="#059669" />
          <path d="M 350 405 Q 320 380 330 350 Q 345 385 350 405 Z" fill="#34D399" />
        </g>

        {/* Left Worker (Man in Purple Shirt with Laptop) */}
        <g>
          {/* Body & Hair */}
          <path d="M 160 380 Q 180 340 210 340 Q 230 340 235 380 L 225 440 L 140 440 Z" fill="#714B67" />
          <circle cx="215" cy="320" r="22" fill="#FCA5A5" />
          <path d="M 195 315 C 195 290 225 290 230 310 C 215 310 205 320 195 315 Z" fill="#1F2937" />

          {/* Laptop */}
          <polygon points="250,440 310,440 295,395 255,395" fill="#334155" />
          <polygon points="255,398 290,398 305,438 250,438" fill="#F8F9FA" />

          {/* Floating Code Card Left */}
          <g className="animate-bubble" style={{ transformOrigin: '230px 370px' }}>
            <rect x="200" y="350" width="55" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
            <line x1="208" y1="360" x2="245" y2="360" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="208" y1="370" x2="235" y2="370" stroke="#714B67" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="208" y1="380" x2="248" y2="380" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>

        {/* Right Worker (Woman in Teal Dress with Laptop) */}
        <g>
          {/* Body & Hair */}
          <path d="M 470 380 Q 480 340 510 340 Q 535 340 545 380 L 560 440 L 475 440 Z" fill="#0D9488" />
          <circle cx="515" cy="320" r="22" fill="#D97706" opacity="0.8" />
          <path d="M 505 300 C 530 295 540 320 535 345 C 520 330 510 315 505 300 Z" fill="#451A03" />

          {/* Laptop */}
          <polygon points="390,440 450,440 445,395 405,395" fill="#334155" />
          <polygon points="408,398 442,398 447,438 393,438" fill="#F8F9FA" />

          {/* Floating Code Card Right */}
          <g className="animate-mail" style={{ transformOrigin: '440px 370px' }}>
            <rect x="430" y="350" width="55" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
            <line x1="438" y1="360" x2="475" y2="360" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="438" y1="370" x2="465" y2="370" stroke="#714B67" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="438" y1="380" x2="478" y2="380" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>

        {/* Bottom Right Double Lines */}
        <line x1="620" y1="520" x2="645" y2="520" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="620" y1="528" x2="645" y2="528" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
