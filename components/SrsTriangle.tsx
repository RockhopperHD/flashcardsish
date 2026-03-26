import React from 'react';
import clsx from 'clsx';
import { normalizeSrsMastery } from '../srs';

interface SrsTriangleProps {
  level?: number;
  className?: string;
}

const getTriangleTone = (level: number): string => {
  switch (normalizeSrsMastery(level)) {
    case 1:
      return 'text-red';
    case 2:
      return 'text-yellow';
    case 3:
      return 'text-green';
    case 4:
      return 'text-blue';
    default:
      return 'text-outline';
  }
};

export const SrsTriangle: React.FC<SrsTriangleProps> = ({
  level = 0,
  className
}) => (
  <svg
    viewBox="0 0 32 32"
    className={clsx('shrink-0', getTriangleTone(level), className)}
    aria-hidden="true"
  >
    <path
      d="M16 5.5 L27 25.5 H5 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);
