import React from 'react';
import './Avatar.css'; // optional styling, create if needed

/**
 * Simple Avatar component that displays an image if `src` is provided,
 * otherwise falls back to initials derived from the `name` prop.
 *
 * Props:
 * - `src` (string): URL of the avatar image.
 * - `name` (string): Full name to generate initials when no image.
 * - `size` (string): One of 'sm', 'md', 'lg' to control dimensions (default: 'md').
 * - `className` (string): Additional CSS classes.
 */
export default function Avatar({ src, name, size = 'md', className = '' }) {
  const initials = React.useMemo(() => {
    if (!name) return '';
    const parts = name.split(' ');
    const first = parts[0][0] ?? '';
    const last = parts[parts.length - 1][0] ?? '';
    return (first + last).toUpperCase();
  }, [name]);

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }[size] || 'w-8 h-8 text-sm';

  return (
    <div className={`avatar inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 ${sizeClasses} ${className}`} aria-label={name} role="img">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover rounded-full" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
