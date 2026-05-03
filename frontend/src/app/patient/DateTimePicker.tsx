"use client";

import React, { useState, useEffect } from "react";

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  className?: string;
  availableDays?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  slotDuration?: number | null;
};

export default function DateTimePicker({
  value,
  onChange,
  label,
  minDate,
  maxDate,
  disabled = false,
  className = "",
  availableDays,
  startTime,
  endTime,
  slotDuration
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Set current month to show tomorrow's month if today is the last day
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // If tomorrow is in a different month, show tomorrow's month
    if (tomorrow.getMonth() !== today.getMonth() || tomorrow.getFullYear() !== today.getFullYear()) {
      setCurrentMonth(tomorrow);
    }
  }, []);
  const [calendarRef, setCalendarRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value) {
      // Parse the datetime value correctly
      const dateTime = new Date(value);
      if (!isNaN(dateTime.getTime())) {
        // Use local date and time to avoid timezone issues
        const year = dateTime.getFullYear();
        const month = String(dateTime.getMonth() + 1).padStart(2, '0');
        const day = String(dateTime.getDate()).padStart(2, '0');
        const hours = String(dateTime.getHours()).padStart(2, '0');
        const minutes = String(dateTime.getMinutes()).padStart(2, '0');
        
        setSelectedDate(`${year}-${month}-${day}`);
        setSelectedTime(`${hours}:${minutes}`);
      }
    }
  }, [value]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef && !calendarRef.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar, calendarRef]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setShowCalendar(false);
    if (selectedTime) {
      // Create a proper datetime string that avoids timezone issues
      const [year, month, day] = date.split('-');
      const [hours, minutes] = selectedTime.split(':');
      const newDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
      
      if (!isNaN(newDateTime.getTime())) {
        // Format as YYYY-MM-DDTHH:MM for the onChange callback
        onChange(`${date}T${selectedTime}`);
      }
    }
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    if (selectedDate) {
      // Create a proper datetime string that avoids timezone issues
      const [year, month, day] = selectedDate.split('-');
      const [hours, minutes] = time.split(':');
      const newDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
      
      if (!isNaN(newDateTime.getTime())) {
        // Format as YYYY-MM-DDTHH:MM for the onChange callback
        onChange(`${selectedDate}T${time}`);
      }
    }
  };

  const getMinDateTime = () => {
    if (minDate) return minDate;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMaxDate = () => {
    if (maxDate) return maxDate;
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    const year = threeMonthsFromNow.getFullYear();
    const month = String(threeMonthsFromNow.getMonth() + 1).padStart(2, '0');
    const day = String(threeMonthsFromNow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      // Create date string in YYYY-MM-DD format without timezone issues
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Check if this date is in the past
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const isPast = dateStr < todayStr;
      const isSelected = dateStr === selectedDate;
      
      let isAvailable = true;
      if (availableDays) {
        const allowedDays = availableDays.toLowerCase().split(',').map(d => d.trim());
        const dayOfWeek = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        // If they didn't write valid days, let's default to true or we could strict match.
        // We'll strict match. If allowedDays is empty, we just allow all.
        if (allowedDays.length > 0 && allowedDays[0] !== "") {
          isAvailable = allowedDays.includes(dayOfWeek);
        }
      }
      
      days.push({
        day,
        dateStr,
        isPast,
        isSelected,
        isAvailable
      });
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-white">
          {label}
        </label>
      )}

      {/* Date Selection */}
      <div className="relative" ref={setCalendarRef}>
        <label className="block text-xs text-white/70 mb-1">Date</label>
        <div className="relative">
          <input
            type="text"
            value={selectedDate ? (() => {
              const [year, month, day] = selectedDate.split('-');
              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
            })() : ''}
            onClick={() => setShowCalendar(!showCalendar)}
            readOnly
            placeholder="Select date"
            disabled={disabled}
            className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none text-sm cursor-pointer disabled:opacity-50"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Calendar Popup */}
        {showCalendar && (
          <div className="absolute z-50 mt-1 bg-background border border-white/20 rounded-lg shadow-lg p-4 min-w-[280px]">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className="p-1 hover:bg-white/10 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="font-medium text-white">{formatMonthYear(currentMonth)}</h3>
              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className="p-1 hover:bg-white/10 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map(day => (
                <div key={day} className="text-xs text-white/60 text-center py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {generateCalendarDays().map((day, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => day && !day.isPast && day.isAvailable && handleDateChange(day.dateStr)}
                  disabled={!day || day.isPast || !day.isAvailable}
                  className={`
                    w-8 h-8 text-xs rounded flex items-center justify-center
                    ${!day ? '' : 
                      day.isPast || !day.isAvailable ? 'text-white/30 cursor-not-allowed' :
                      day.isSelected ? 'bg-blue-600 text-white' :
                      'text-white hover:bg-white/10'
                    }
                  `}
                >
                  {day?.day}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Time Selection */}
      <div>
        <label className="block text-xs text-white/70 mb-1">Time</label>
        <select
          value={selectedTime}
          onChange={(e) => handleTimeChange(e.target.value)}
          disabled={disabled || !selectedDate}
          className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none text-sm disabled:opacity-50"
        >
          <option value="">Select time</option>
          {(() => {
            if (startTime && endTime && slotDuration) {
              const slots = [];
              let current = new Date(`2000-01-01T${startTime}`);
              const end = new Date(`2000-01-01T${endTime}`);
              
              while (current <= end) {
                const hours = String(current.getHours()).padStart(2, '0');
                const minutes = String(current.getMinutes()).padStart(2, '0');
                slots.push(`${hours}:${minutes}`);
                current.setMinutes(current.getMinutes() + slotDuration);
              }
              return slots.map(time => (
                <option key={time} value={time}>
                  {new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </option>
              ));
            } else {
              // Default fallback
              return Array.from({ length: 24 }, (_, i) => {
                const hour = i;
                const timeSlots = [`${hour.toString().padStart(2, '0')}:00`, `${hour.toString().padStart(2, '0')}:30`];
                return timeSlots.map(time => (
                  <option key={time} value={time}>
                    {new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </option>
                ));
              }).flat();
            }
          })()}
        </select>
      </div>

      {/* Selected DateTime Display */}
      {selectedDate && selectedTime && (
        <div className="mt-3 p-3 bg-blue-600/20 border border-blue-600/30 rounded">
          <div className="text-xs text-blue-400 mb-1">Selected:</div>
          <div className="text-sm text-white">
            {(() => {
              const [year, month, day] = selectedDate.split('-');
              const [hours, minutes] = selectedTime.split(':');
              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
              return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
            })()} at {(() => {
              const [hours, minutes] = selectedTime.split(':');
              const date = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
              return date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}