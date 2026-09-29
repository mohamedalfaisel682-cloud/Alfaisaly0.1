import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { parseExecutionTimeToDate } from '../lib/dateUtils';

export const CountdownTimer = ({ targetDate, className }: { targetDate: string, className?: string }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const parsedDate = parseExecutionTimeToDate(targetDate);
      if (!parsedDate) return '';
      const difference = parsedDate.getTime() - new Date().getTime();
      if (difference <= 0) return 'انتهى الوقت';

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      const parts = [];
      if (hours > 0) parts.push(`${hours}س`);
      if (minutes > 0) parts.push(`${minutes}د`);
      parts.push(`${seconds}ث`);

      return parts.join(' : ');
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return <span className={cn("font-mono font-bold", className)} dir="ltr">{timeLeft}</span>;
}
