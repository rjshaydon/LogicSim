import React from 'react';

// --- Shape Renderers ---
const GateRenderer = ({ type, width, height, color }) => {
  const w = width; const h = height;
  const stroke = '#e0e0e0'; const fill = '#222222'; const strokeWidth = 2; const r = 4;
  const bubbleGap = (type === 'NAND' || type === 'NOR' || type === 'NOT') ? 16 : 0;
  const fullBodyW = w - bubbleGap;
  const orControlY = h * 0.1; const orBackCurveDepth = fullBodyW * 0.25;

  switch (type) {
    case 'AND': case 'NAND': return ( <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute top-0 left-0 pointer-events-none"> <path d={`M 0 0 L ${fullBodyW * 0.5} 0 Q ${fullBodyW} 0 ${fullBodyW} ${h/2} Q ${fullBodyW} ${h} ${fullBodyW * 0.5} ${h} L 0 ${h} Z`} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} /> {type === 'NAND' && <circle cx={w - r - 2} cy={h/2} r={r} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} />} </svg> );
    case 'OR': case 'NOR': return ( <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute top-0 left-0 pointer-events-none"> <path d={`M 0 0 C ${fullBodyW * 0.1} 0 ${fullBodyW * 0.7} ${orControlY} ${fullBodyW} ${h/2} C ${fullBodyW * 0.7} ${h - orControlY} ${fullBodyW * 0.1} ${h} 0 ${h} Q ${orBackCurveDepth} ${h/2} 0 0 Z`} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} /> {type === 'NOR' && <circle cx={w - r - 2} cy={h/2} r={r} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} />} </svg> );
    case 'XOR': { const xRail = 3; const xBody = 8; const xorBodyW = fullBodyW; return ( <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute top-0 left-0 pointer-events-none"> <path d={`M ${xRail} 0 Q ${orBackCurveDepth + xRail} ${h/2} ${xRail} ${h}`} fill="none" stroke={color || stroke} strokeWidth={strokeWidth} /> <path d={`M ${xBody} 0 C ${xorBodyW * 0.1 + xBody} 0 ${xorBodyW * 0.7 + xBody} ${orControlY} ${xorBodyW} ${h/2} C ${xorBodyW * 0.7 + xBody} ${h - orControlY} ${xorBodyW * 0.1 + xBody} ${h} ${xBody} ${h} Q ${orBackCurveDepth + xBody} ${h/2} ${xBody} 0 Z`} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} /> </svg> ); }
    case 'NOT': return ( <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute top-0 left-0 pointer-events-none"> <path d={`M 0 0 L ${fullBodyW} ${h/2} L 0 ${h} Z`} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} /> <circle cx={w - r - 2} cy={h/2} r={r} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} /> </svg> );
    case 'TRI_BUFFER': return ( <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute top-0 left-0 pointer-events-none"> <path d={`M ${w*0.2} ${h*0.2} L ${w*0.8} ${h*0.5} L ${w*0.2} ${h*0.8} Z`} fill={fill} stroke={color || stroke} strokeWidth={strokeWidth} /> </svg> );
    default: return null;
  }
};

export default GateRenderer;
