import { useEffect, useState } from 'react';
import { formatTimeInput, parseTimeInput } from '../utils/calendar';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
}

const TimeInput = ({ value, onChange, className, required = false, placeholder = 'HH:MM' }: TimeInputProps) => {
  const [text, setText] = useState(formatTimeInput(value));

  useEffect(() => {
    setText(formatTimeInput(value));
  }, [value]);

  return (
    <input
      type="time"
      className={`time-input ${className || ''}`.trim()}
      autoComplete="on"
      placeholder={placeholder}
      pattern="\\d{1,2}:\\d{2}"
      value={text}
      required={required}
      onChange={event => {
        const nextText = event.target.value;
        setText(nextText);
        if (nextText.trim() === '') {
          if (!required) onChange('');
          return;
        }
        const parsed = parseTimeInput(nextText);
        if (parsed) onChange(parsed);
      }}
      onBlur={() => setText(formatTimeInput(value))}
    />
  );
};

export default TimeInput;
