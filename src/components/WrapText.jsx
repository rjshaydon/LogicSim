import React from 'react';

const WrapText = ({ text, width, className = "" }) => {
  if (!text) return null;
  const words = text.toString().split(' ');
  const lines = [];
  let currentLine = words[0];
  const maxCharsPerLine = Math.max(1, Math.floor((width || 80) / 6));
  for (let i = 1; i < words.length; i++) {
    if ((currentLine + " " + words[i]).length <= maxCharsPerLine) {
      currentLine += " " + words[i];
    } else { lines.push(currentLine); currentLine = words[i]; }
  }
  lines.push(currentLine);
  return (
    <div className={`flex flex-col items-center justify-center w-full h-full p-0.5 ${className}`}>
      {lines.map((line, i) => ( <div key={i} className="text-[10px] font-bold text-white/90 text-center leading-none whitespace-nowrap overflow-hidden w-full">{line}</div> ))}
    </div>
  );
};

export default WrapText;
