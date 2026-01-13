import React from 'react';

const Mini7Seg = ({ state }) => (
  <svg viewBox="0 0 60 100" className="w-5 h-8 opacity-90 bg-black/20 rounded flex-shrink-0">
    <path d="M 10 10 L 50 10 L 45 15 L 15 15 Z" fill={state?.a ? '#ef4444' : '#331111'} />
    <path d="M 50 10 L 55 15 L 55 45 L 50 50 L 45 45 L 45 15 Z" fill={state?.b ? '#ef4444' : '#331111'} />
    <path d="M 50 50 L 55 55 L 55 85 L 50 90 L 45 85 L 45 55 Z" fill={state?.c ? '#ef4444' : '#331111'} />
    <path d="M 10 90 L 50 90 L 45 85 L 15 85 Z" fill={state?.d ? '#ef4444' : '#331111'} />
    <path d="M 10 50 L 15 55 L 15 85 L 10 90 L 5 85 L 5 55 Z" fill={state?.e ? '#ef4444' : '#331111'} />
    <path d="M 10 10 L 15 15 L 15 45 L 10 50 L 5 45 L 5 15 Z" fill={state?.f ? '#ef4444' : '#331111'} />
    <path d="M 10 50 L 50 50 L 45 55 L 15 55 L 10 50 L 15 45 L 45 45 Z" fill={state?.g ? '#ef4444' : '#331111'} />
    <circle cx="55" cy="90" r="3" fill={state?.dp ? '#ef4444' : '#331111'} />
  </svg>
);

export default Mini7Seg;
