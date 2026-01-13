import React from 'react';

const MiniGridDisplay = ({ state, bits }) => {
  const is8Bit = bits === 8;
  const renderCell = (bit) => { const isActive = state?.[bit]; return <div key={bit} className={`w-1.5 h-1.5 rounded-sm transition-colors ${isActive ? 'bg-emerald-400 shadow-[0_0_2px_#34d399]' : 'bg-white/10'}`} />; };
  return (
    <div className={`grid ${is8Bit ? 'grid-cols-4 grid-rows-2' : 'grid-cols-4 grid-rows-1'} gap-0.5 pointer-events-none p-0.5 bg-black/20 rounded flex-shrink-0`}>
      {is8Bit ? ( <> {[7,6,5,4].map(renderCell)} {[3,2,1,0].map(renderCell)} </> ) : ( [3,2,1,0].map(renderCell) )}
    </div>
  );
};

export default MiniGridDisplay;
