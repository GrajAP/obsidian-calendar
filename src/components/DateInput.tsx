import { useEffect, useState } from 'react';
import { formatDateInput, parseDateInput } from '../utils/calendar';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

const DateInput = ({ value, onChange, required = false, className, placeholder = 'dd/mm/yyyy' }: DateInputProps) => {
  const [text, setText] = useState(value ? formatDateInput(value) : '');

  useEffect(() => {
    setText(value ? formatDateInput(value) : '');
  }, [value]);

  return (
    <input
      type="text"
      className={`date-input ${className || ''}`.trim()}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      pattern={"\\d{1,2}/\\d{1,2}/\\d{4}"}
      value={text}
      required={required}
      onChange={event => {
        const nextText = event.target.value;
        setText(nextText);
        if (nextText.trim() === '') {
          if (!required) onChange('');
          return;
        }
        const parsed = parseDateInput(nextText);
        if (parsed) onChange(parsed);
      }}
      onBlur={() => setText(value ? formatDateInput(value) : '')}
    />
  );
};

export default DateInput;
