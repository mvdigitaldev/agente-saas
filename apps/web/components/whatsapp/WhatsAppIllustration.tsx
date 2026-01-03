import React from "react";

interface WhatsAppIllustrationProps {
  className?: string;
}

export function WhatsAppIllustration({ className = "" }: WhatsAppIllustrationProps) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 400 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full whatsapp-illustration"
      >
        {/* Background decorative elements */}
        <circle
          cx="350"
          cy="100"
          r="60"
          fill="currentColor"
          className="text-primary/5"
        />
        <circle
          cx="50"
          cy="450"
          r="40"
          fill="currentColor"
          className="text-primary/5"
        />

        {/* Smartphone */}
        <g transform="translate(100, 50)">
          {/* Phone body */}
          <rect
            x="0"
            y="0"
            width="200"
            height="380"
            rx="30"
            ry="30"
            fill="white"
            stroke="rgba(87, 87, 87, 0.5)"
            strokeWidth="2"
          />
          
          {/* Phone screen */}
          <rect
            x="20"
            y="60"
            width="160"
            height="260"
            rx="8"
            fill="white"
            stroke="rgba(145, 145, 145, 0.5)"
            strokeWidth="1"
          />

          {/* QR Code */}
          <g transform="translate(30, 80)">
            <svg
              width="160"
              height="160"
              viewBox="0 0 24.00 24.00"
              xmlns="http://www.w3.org/2000/svg"
              id="qr-code"
              className="icon glyph"
              fill="#000000"
              stroke="#000000"
              strokeWidth="0.00024000000000000003"
            >
              <g id="SVGRepo_bgCarrier" strokeWidth="0" transform="translate(0,0), scale(1)">
                <rect x="0" y="0" width="24.00" height="24.00" rx="4.08" fill="#ededed" strokeWidth="0" />
              </g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" stroke="#CCCCCC" strokeWidth="0.048" />
              <g id="SVGRepo_iconCarrier">
                <path
                  d="M11,4V9a2,2,0,0,1-2,2H4A2,2,0,0,1,2,9V4A2,2,0,0,1,4,2H9A2,2,0,0,1,11,4Zm9-2H15a2,2,0,0,0-2,2V9a2,2,0,0,0,2,2h5a2,2,0,0,0,2-2V4A2,2,0,0,0,20,2ZM9,13H4a2,2,0,0,0-2,2v5a2,2,0,0,0,2,2H9a2,2,0,0,0,2-2V15A2,2,0,0,0,9,13Zm5,5h3a1,1,0,0,0,1-1V14a1,1,0,0,0-1-1H14a1,1,0,0,0-1,1v3A1,1,0,0,0,14,18Zm7-5a1,1,0,0,0-1,1v5a1,1,0,0,1-1,1H14a1,1,0,0,0,0,2h5a3,3,0,0,0,3-3V14A1,1,0,0,0,21,13Z"
                  style={{ fill: "#231f20" }}
                />
              </g>
            </svg>
          </g>

          {/* Phone notch */}
          <rect
            x="70"
            y="0"
            width="60"
            height="25"
            rx="12"
            fill="currentColor"
            className="text-border"
          />
        </g>

        {/* Success checkmark icon */}
        <g transform="translate(320, 80)">
          <circle
            cx="0"
            cy="0"
            r="24"
            fill="currentColor"
            className="text-green-500"
          />
          <path
            d="M-8 -2 L-2 4 L8 -6"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* Notification bell icon */}
        <g transform="translate(50, 200)">
          <path
            d="M0 0 L12 0 L12 8 L6 12 L0 8 Z"
            fill="currentColor"
            className="text-primary"
          />
          <circle
            cx="6"
            cy="4"
            r="2"
            fill="white"
          />
          {/* Notification lines */}
          <line
            x1="6"
            y1="0"
            x2="6"
            y2="-8"
            stroke="currentColor"
            strokeWidth="2"
            className="text-primary"
            strokeLinecap="round"
          />
          <circle
            cx="6"
            cy="-12"
            r="3"
            fill="currentColor"
            className="text-primary"
          />
        </g>

        {/* Message bubble icon */}
        <g transform="translate(320, 300)">
          <path
            d="M0 0 Q-8 -8 -16 -8 Q-24 -8 -24 0 L-24 16 Q-24 24 -16 24 L-8 24 L0 32 L0 16 Z"
            fill="currentColor"
            className="text-yellow-400"
            transform="translate(12, 0)"
          />
          <circle
            cx="0"
            cy="8"
            r="2"
            fill="white"
          />
          <circle
            cx="6"
            cy="8"
            r="2"
            fill="white"
          />
          <circle
            cx="12"
            cy="8"
            r="2"
            fill="white"
          />
        </g>

        {/* Security lock icon */}
        <g transform="translate(50, 350)">
          <rect
            x="-8"
            y="0"
            width="16"
            height="20"
            rx="2"
            fill="currentColor"
            className="text-green-600"
          />
          <path
            d="M-6 -4 Q-6 -8 -2 -8 Q2 -8 2 -4"
            stroke="currentColor"
            strokeWidth="2"
            className="text-green-600"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Decorative dashed lines */}
        <path
          d="M 50 150 Q 150 200 250 150"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5,5"
          fill="none"
          className="text-primary/20"
        />
        <path
          d="M 150 250 Q 200 300 250 350"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5,5"
          fill="none"
          className="text-primary/20"
        />
      </svg>
    </div>
  );
}

