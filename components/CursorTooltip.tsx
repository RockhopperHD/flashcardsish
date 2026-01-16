import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface CursorTooltipProps {
    content: React.ReactNode;
    isEnabled?: boolean;
    children: React.ReactElement;
    className?: string; // Class for the wrapper (the child clone)
    tooltipClassName?: string; // Class for the tooltip popup itself
}

export const CursorTooltip: React.FC<CursorTooltipProps> = ({ content, isEnabled = true, children, className, tooltipClassName }) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });

    // If content is empty/null, don't show
    if (!content) return children;

    const handleMouseEnter = (e: React.MouseEvent) => {
        setVisible(true);
        setPos({ x: e.clientX, y: e.clientY });
        children.props.onMouseEnter?.(e);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setPos({ x: e.clientX, y: e.clientY });
        children.props.onMouseMove?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent) => {
        setVisible(false);
        children.props.onMouseLeave?.(e);
    };

    // Clone child to attach handlers and style
    const child = React.cloneElement(children, {
        ...children.props,
        onMouseEnter: (e: React.MouseEvent) => {
            handleMouseEnter(e);
        },
        onMouseMove: (e: React.MouseEvent) => {
            handleMouseMove(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
            handleMouseLeave(e);
        },
        style: {
            ...children.props.style,
            cursor: isEnabled ? 'help' : children.props.style?.cursor // Native browser '?' cursor
        },
        className: clsx(children.props.className, className)
    });

    if (!isEnabled) return child;

    return (
        <>
            {child}
            {visible && createPortal(
                <div
                    className={clsx(
                        "fixed z-[9999] px-4 py-3 rounded-lg text-xs font-medium shadow-xl pointer-events-none bg-[#422006] text-[#FEF3C7] border border-[#78350F] text-left max-w-xs break-words whitespace-pre-wrap",
                        tooltipClassName
                    )}
                    style={{
                        top: pos.y + 16, // Offset to not overlap cursor immediately
                        left: pos.x + 12,
                    }}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};
