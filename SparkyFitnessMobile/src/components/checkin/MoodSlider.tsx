import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
} from 'react-native';
import { useCSSVariable } from 'uniwind';

interface MoodSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  /** Shown inside the drag thumb (the current band's emoji). */
  emoji: string;
  accessibilityLabel?: string;
}

const THUMB_SIZE = 32;
const TRACK_HEIGHT = 6;
const HIT_SLOP = { top: 16, bottom: 16, left: 0, right: 0 };
// A move must be more horizontal than vertical before the slider claims the
// touch from an enclosing ScrollView — matches the direction-gating idea
// ChartTouchOverlay already uses in this codebase (there via a long-press
// delay instead, since that overlay sits passively atop scrollable chart
// content; a slider is the primary control on its row, so it can claim on
// the first clearly-horizontal move rather than waiting).
const DIRECTION_THRESHOLD_PX = 4;

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** Rounds to the nearest step and clamps to [min, max]. */
function quantize(rawValue: number, min: number, max: number, step: number): number {
  const stepped = Math.round((rawValue - min) / step) * step + min;
  return clamp(stepped, min, max);
}

const getTouchPoint = (
  event: NativeSyntheticEvent<NativeTouchEvent> | GestureResponderEvent | undefined,
): { x: number; y: number } | null => {
  const nativeEvent = event?.nativeEvent;
  if (!nativeEvent) return null;
  const touch = nativeEvent.touches?.[0] ?? nativeEvent.changedTouches?.[0] ?? nativeEvent;
  if (typeof touch.locationX !== 'number' || typeof touch.locationY !== 'number') return null;
  return { x: touch.locationX, y: touch.locationY };
};

/**
 * A horizontal drag slider (10-100 style bounded range), matching web's
 * MoodMeter slider. Built on raw touch responders rather than
 * `@react-native-community/slider` or a gesture library — this app cannot
 * currently take a new native dependency (it would require an Expo prebuild,
 * which is blocked by an unrelated pre-existing lockfile/patch issue), and
 * this mirrors the same direct-touch-event pattern `ChartTouchOverlay.tsx`
 * already uses successfully elsewhere in this codebase.
 *
 * The emoji quick-jump row rendered alongside this component (in
 * FastingMoodTab) is the reliable fallback path for setting mood — a plain
 * `TouchableOpacity onPress`, no drag math involved — so a user is never
 * solely dependent on getting this drag gesture exactly right.
 */
const MoodSlider: React.FC<MoodSliderProps> = ({ value, min, max, step, onValueChange, emoji, accessibilityLabel }) => {
  const [trackColor, accentColor] = useCSSVariable(['--color-raised', '--color-accent-primary']) as [string, string];

  const [trackWidth, setTrackWidth] = useState(0);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);

  const valueToRatio = (v: number): number => (max === min ? 0 : (v - min) / (max - min));
  const ratioToValue = (ratio: number): number => quantize(min + clamp(ratio, 0, 1) * (max - min), min, max, step);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const commitFromLocalX = (localX: number) => {
    if (usableWidth <= 0) return;
    // The thumb is centered under the touch — offset by half its width so
    // the value under the finger, not the thumb's leading edge, is what
    // gets set.
    const ratio = (localX - THUMB_SIZE / 2) / usableWidth;
    const next = ratioToValue(ratio);
    if (next !== value) onValueChange(next);
  };

  const handleTouchStart = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    const point = getTouchPoint(e);
    startPointRef.current = point;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    const point = getTouchPoint(e);
    if (!point) return;
    const start = startPointRef.current;

    if (!isDraggingRef.current) {
      if (!start) return;
      const dx = Math.abs(point.x - start.x);
      const dy = Math.abs(point.y - start.y);
      if (dx < DIRECTION_THRESHOLD_PX || dx <= dy) return;
      isDraggingRef.current = true;
    }

    commitFromLocalX(point.x);
  };

  const handleTouchEnd = () => {
    startPointRef.current = null;
    isDraggingRef.current = false;
  };

  const thumbLeft = usableWidth * valueToRatio(value);

  return (
    <View
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMoveShouldSetResponderCapture={() => isDraggingRef.current}
      onMoveShouldSetResponder={() => isDraggingRef.current}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
      onResponderTerminate={handleTouchEnd}
      onResponderTerminationRequest={() => !isDraggingRef.current}
      hitSlop={HIT_SLOP}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      style={{ height: THUMB_SIZE, justifyContent: 'center' }}
    >
      <View
        pointerEvents="none"
        style={{
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: trackColor,
        }}
      />
      {trackWidth > 0 && (
        // `pointerEvents="none"` is load-bearing, not decorative: without it,
        // a touch that starts on the thumb hit-tests to *this* view, and RN
        // reports `locationX`/`locationY` relative to whatever view was
        // actually touched -- not the outer track container that owns the
        // gesture handlers. Since the thumb moves every time `value` changes,
        // that coordinate frame shifts out from under the finger on every
        // render, producing a feedback loop that reads as rapid jitter.
        // Forcing the touch to always hit-test through to the outer
        // container keeps `locationX` in the track's stable coordinate
        // frame regardless of where the drag started.
        <View
          testID="mood-slider-thumb"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: thumbLeft,
            top: 0,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: accentColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>{emoji}</Text>
        </View>
      )}
    </View>
  );
};

export default MoodSlider;
