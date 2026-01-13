import React from 'react';
import WrapText from './WrapText.jsx';
import Mini7Seg from './Mini7Seg.jsx';
import MiniGridDisplay from './MiniGridDisplay.jsx';

// Recursive Component to render chip face content
const ChipFace = ({ node, onLabelDoubleClick, showLabel = true }) => {
  const visibleIds = node.def?.visibleElements || node.visibleElements;
  const hasVisibleElements = visibleIds && visibleIds.length > 0;

  return (
    <div className="flex flex-col items-center w-full h-full overflow-hidden">
      {/* Conditional Label */}
      {showLabel && (
        <div onDoubleClick={onLabelDoubleClick} className="flex-shrink-0 w-full flex justify-center cursor-text pointer-events-auto mb-0.5 z-10 pt-1">
          <WrapText text={node.label} width={node.def?.width || 80} className="!h-auto !justify-start" />
        </div>
      )}

      {hasVisibleElements && (() => {
        const internalNodes = node.internalData?.nodes || [];
        const visibleNodes = internalNodes.filter(n => visibleIds.includes(n.id));
        visibleNodes.sort((a, b) => a.x - b.x);

        return (
          <div className={`flex-1 flex items-center justify-center w-full overflow-hidden min-h-0 ${showLabel ? 'gap-1' : 'gap-0'}`}>
            {visibleNodes.map(child => (
              <div key={child.id} className="flex-shrink-0 flex items-center justify-center">
                {['7SEG', 'PIN_IN_4', 'PIN_IN_8', 'PIN_OUT_4', 'PIN_OUT_8'].includes(child.type) ? (
                  child.type === '7SEG' ? (
                    <Mini7Seg state={child.state} />
                  ) : (
                    <MiniGridDisplay state={child.state} bits={child.type.includes('8') ? 8 : 4} />
                  )
                ) : (
                  // Recursive case for sub-chips: Tight packing, no scale, padding around group
                  <div className="border border-white/10 bg-black/20 rounded p-1 flex items-center justify-center">
                    {/* Pass showLabel={false} to hide inner labels */}
                    <ChipFace node={child} onLabelDoubleClick={(e) => e.stopPropagation()} showLabel={false} />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default ChipFace;
