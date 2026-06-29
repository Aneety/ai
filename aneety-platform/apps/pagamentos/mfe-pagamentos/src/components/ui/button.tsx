import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils';

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('button', className)} {...props} />;
}
