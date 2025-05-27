import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TimeUtilityService {
  private readonly RETURN_DEADLINE_HOUR = 15; // 3 PM in 24-hour format
  private readonly RETURN_DEADLINE_MINUTE = 0;

  constructor() { }

  /**
   * Sets the time of a date to 3:00 PM
   * @param date The date to modify
   * @returns A new date with time set to 3:00 PM
   */
  setTimeTo3PM(date: Date): Date {
    const newDate = new Date(date);
    newDate.setHours(this.RETURN_DEADLINE_HOUR, this.RETURN_DEADLINE_MINUTE, 0, 0);
    return newDate;
  }

  /**
   * Gets today's date with time set to 3:00 PM
   * @returns Today's date at 3:00 PM
   */
  getTodayAt3PM(): Date {
    const today = new Date();
    return this.setTimeTo3PM(today);
  }

  /**
   * Gets tomorrow's date with time set to 3:00 PM
   * @returns Tomorrow's date at 3:00 PM
   */
  getTomorrowAt3PM(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.setTimeTo3PM(tomorrow);
  }

  /**
   * Checks if the current time has passed 3:00 PM today
   * @returns True if current time is after 3:00 PM today
   */
  isPast3PMToday(): boolean {
    const now = new Date();
    const todayAt3PM = this.getTodayAt3PM();
    return now > todayAt3PM;
  }

  /**
   * Checks if a given date/time is past the 3:00 PM deadline
   * @param date The date to check
   * @returns True if the date is past 3:00 PM
   */
  isPastDeadline(date: Date): boolean {
    const deadlineForDate = this.setTimeTo3PM(date);
    return new Date() > deadlineForDate;
  }

  /**
   * Validates if a return date is valid (not in the past and respects 3PM rule)
   * @param returnDate The proposed return date
   * @returns Object with validation result and message
   */
  validateReturnDate(returnDate: Date): { isValid: boolean; message: string } {
    const now = new Date();
    const returnAt3PM = this.setTimeTo3PM(returnDate);

    // Check if return date is in the past
    if (returnAt3PM < now) {
      return {
        isValid: false,
        message: 'Return date cannot be in the past'
      };
    }

    // If selecting today and it's already past 3 PM, not allowed
    if (this.isSameDay(returnDate, now) && this.isPast3PMToday()) {
      return {
        isValid: false,
        message: 'Cannot set return date for today after 3:00 PM. Please select tomorrow or later.'
      };
    }

    return {
      isValid: true,
      message: `Cash must be returned by 3:00 PM on ${returnDate.toDateString()}`
    };
  }

  /**
   * Gets the next valid return date (today if before 3PM, tomorrow if after 3PM)
   * @returns The next valid return date at 3:00 PM
   */
  getNextValidReturnDate(): Date {
    if (this.isPast3PMToday()) {
      return this.getTomorrowAt3PM();
    } else {
      return this.getTodayAt3PM();
    }
  }

  /**
   * Calculates time remaining until 3:00 PM deadline
   * @param returnDate The return deadline date
   * @returns Object with time remaining information
   */
  getTimeUntilDeadline(returnDate: Date): {
    isOverdue: boolean;
    hoursRemaining: number;
    minutesRemaining: number;
    message: string
  } {
    const now = new Date();
    const deadline = this.setTimeTo3PM(returnDate);
    const timeDiff = deadline.getTime() - now.getTime();

    if (timeDiff <= 0) {
      const overdueDiff = Math.abs(timeDiff);
      const overdueHours = Math.floor(overdueDiff / (1000 * 60 * 60));
      const overdueMinutes = Math.floor((overdueDiff % (1000 * 60 * 60)) / (1000 * 60));

      return {
        isOverdue: true,
        hoursRemaining: 0,
        minutesRemaining: 0,
        message: `Overdue by ${overdueHours}h ${overdueMinutes}m`
      };
    }

    const hoursRemaining = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    let message = '';
    if (hoursRemaining > 0) {
      message = `${hoursRemaining}h ${minutesRemaining}m remaining`;
    } else {
      message = `${minutesRemaining}m remaining`;
    }

    return {
      isOverdue: false,
      hoursRemaining,
      minutesRemaining,
      message
    };
  }

  /**
   * Checks if two dates are on the same day
   * @param date1 First date
   * @param date2 Second date
   * @returns True if both dates are on the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Formats a date to show date and 3:00 PM time
   * @param date The date to format
   * @returns Formatted string showing date and 3:00 PM
   */
  formatReturnDeadline(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return `${date.toLocaleDateString('en-US', options)} at 3:00 PM`;
  }

  /**
   * Gets the return deadline hour (3 PM)
   * @returns The deadline hour (15)
   */
  getDeadlineHour(): number {
    return this.RETURN_DEADLINE_HOUR;
  }

  /**
   * Gets the return deadline minute (0)
   * @returns The deadline minute (0)
   */
  getDeadlineMinute(): number {
    return this.RETURN_DEADLINE_MINUTE;
  }
}
