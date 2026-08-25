import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MoodSlider from '../../../src/components/checkin/MoodSlider';

const createTouchEvent = (locationX: number, locationY: number) => ({
  nativeEvent: {
    touches: [{ locationX, locationY }],
    changedTouches: [{ locationX, locationY }],
    locationX,
    locationY,
  },
});

const layoutEvent = (width: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height: 32 } },
});

function renderSlider(props: Partial<React.ComponentProps<typeof MoodSlider>> = {}) {
  const onValueChange = jest.fn();
  render(
    <MoodSlider
      value={50}
      min={10}
      max={100}
      step={5}
      emoji="🙂"
      onValueChange={onValueChange}
      accessibilityLabel="Overall mood"
      {...props}
    />,
  );
  return { onValueChange };
}

describe('MoodSlider', () => {
  test('renders a thumb once its width is measured', () => {
    renderSlider();
    fireEvent(screen.getByLabelText('Overall mood'), 'layout', layoutEvent(300));

    expect(screen.getByTestId('mood-slider-thumb')).toBeTruthy();
  });

  test('a horizontal drag commits a quantized value within bounds', () => {
    const { onValueChange } = renderSlider({ value: 10 });
    const el = screen.getByLabelText('Overall mood');
    fireEvent(el, 'layout', layoutEvent(300));

    // Drag from the left edge to roughly the middle of the track.
    fireEvent(el, 'touchStart', createTouchEvent(0, 16));
    fireEvent(el, 'touchMove', createTouchEvent(150, 16));

    expect(onValueChange).toHaveBeenCalled();
    const committed = onValueChange.mock.calls[onValueChange.mock.calls.length - 1][0];
    expect(committed).toBeGreaterThanOrEqual(10);
    expect(committed).toBeLessThanOrEqual(100);
    expect(committed % 5).toBe(0);
  });

  test('dragging to the far right clamps at max, far left clamps at min', () => {
    const { onValueChange } = renderSlider({ value: 50 });
    const el = screen.getByLabelText('Overall mood');
    fireEvent(el, 'layout', layoutEvent(300));

    fireEvent(el, 'touchStart', createTouchEvent(150, 16));
    fireEvent(el, 'touchMove', createTouchEvent(1000, 16));
    expect(onValueChange).toHaveBeenLastCalledWith(100);

    fireEvent(el, 'touchEnd', createTouchEvent(1000, 16));
    fireEvent(el, 'touchStart', createTouchEvent(150, 16));
    fireEvent(el, 'touchMove', createTouchEvent(-1000, 16));
    expect(onValueChange).toHaveBeenLastCalledWith(10);
  });

  test('a vertically-dominant move (a scroll attempt) does not commit a value', () => {
    const { onValueChange } = renderSlider({ value: 50 });
    const el = screen.getByLabelText('Overall mood');
    fireEvent(el, 'layout', layoutEvent(300));

    fireEvent(el, 'touchStart', createTouchEvent(150, 16));
    fireEvent(el, 'touchMove', createTouchEvent(152, 60));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
