import { View, Text, TouchableOpacity } from 'react-native';

export type Segment<T extends string> = {
  key: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  /** Number of rows to wrap the segments across. Only applies to the default 'segmented' variant. Defaults to 1 (single row). */
  rows?: number;
  /**
   * 'segmented' (default): pill track with a background chip behind the active segment.
   * 'underline': flat row of tabs with an accent underline on the active tab and no
   * track — reads as page-level navigation rather than a form control.
   */
  variant?: 'segmented' | 'underline';
};

const SegmentedControl = <T extends string>({
  segments,
  activeKey,
  onSelect,
  rows = 1,
  variant = 'segmented',
}: SegmentedControlProps<T>) => {
  if (variant === 'underline') {
    return (
      <View className="flex-row px-2">
        {segments.map(segment => {
          const active = activeKey === segment.key;
          return (
            <TouchableOpacity
              key={segment.key}
              onPress={() => onSelect(segment.key)}
              className={`flex-1 items-center py-2.5 ${
                active
                  ? 'border-b-2 border-accent-primary -mb-px'
                  : 'border-b border-border-subtle'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm ${
                  active
                    ? 'text-text-primary font-semibold'
                    : 'text-text-muted font-medium'
                }`}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  const perRow = Math.ceil(segments.length / rows);
  const rowChunks: Segment<T>[][] = [];
  for (let i = 0; i < segments.length; i += perRow) {
    rowChunks.push(segments.slice(i, i + perRow));
  }

  return (
    <View>
      <View
        className={`bg-raised p-1 rounded-lg ${
          rowChunks.length > 1 ? 'gap-1' : ''
        }`}
      >
        {rowChunks.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row">
            {row.map(segment => (
              <TouchableOpacity
                key={segment.key}
                onPress={() => onSelect(segment.key)}
                className={`flex-1 py-2 rounded-md items-center ${
                  activeKey === segment.key ? 'bg-surface' : ''
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium ${
                    activeKey === segment.key
                      ? 'text-text-primary'
                      : 'text-text-muted'
                  }`}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {segment.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

export default SegmentedControl;
