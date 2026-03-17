'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TripMonthSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function TripMonthSelector({ value, onChange }: TripMonthSelectorProps) {
  const months = [];
  for (let m = 4; m <= 12; m++) {
    months.push({
      value: `2026-${String(m).padStart(2, '0')}`,
      label: `${monthNames[m - 1]} 2026`,
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground text-sm">Trip month:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select month" />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
