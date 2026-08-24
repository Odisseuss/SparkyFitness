import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenHeader } from '../hooks/useScreenHeader';
import CalendarSheet, { type CalendarSheetRef } from '../components/CalendarSheet';
import SafeImage from '../components/SafeImage';
import { useCheckInPhotoDates, useCheckInPhotosForDate, useCheckInPhotoImageSource } from '../hooks/useCheckInPhotos';
import type { PhotoType } from '../services/api/checkInPhotosApi';
import { getTodayDate } from '../utils/dateUtils';

const PHOTO_TYPES: { type: PhotoType; label: string }[] = [
  { type: 'front', label: 'Front' },
  { type: 'back', label: 'Back' },
  { type: 'side', label: 'Side' },
];

const PhotoCell: React.FC<{ photoId: string | undefined }> = ({ photoId }) => {
  const { source } = useCheckInPhotoImageSource(photoId);
  return (
    <View className="flex-1 aspect-[3/4] rounded-lg bg-raised items-center justify-center overflow-hidden">
      {source ? (
        <SafeImage source={source} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text className="text-text-muted text-xs">No photo</Text>
      )}
    </View>
  );
};

const ProgressPhotosCompareScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const header = useScreenHeader({ title: 'Compare Photos', left: { kind: 'back' } });

  const { data: photoDates = [], isSuccess: photoDatesLoaded } = useCheckInPhotoDates();
  const today = getTodayDate();
  const [leftDate, setLeftDate] = useState(today);
  const [rightDate, setRightDate] = useState(today);

  // `photoDates` resolves asynchronously (it starts as `[]` before the query
  // settles), so the "two most recent photo dates" default can't be a useState
  // initializer — it would always see the pre-fetch empty array. Apply it once,
  // the first time the dates query resolves, and never again afterward so it
  // can't clobber a date the user has since picked in a CalendarSheet.
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (defaultsApplied.current || !photoDatesLoaded) return;
    defaultsApplied.current = true;
    setLeftDate(photoDates[1] ?? today);
    setRightDate(photoDates[0] ?? today);
    // `photoDates`/`today` intentionally excluded: this effect must run only
    // once, guarded by `defaultsApplied`, using whatever values are current
    // when the dates query first resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoDatesLoaded]);

  const leftSheetRef = useRef<CalendarSheetRef>(null);
  const rightSheetRef = useRef<CalendarSheetRef>(null);

  const { data: leftPhotos = [] } = useCheckInPhotosForDate(leftDate);
  const { data: rightPhotos = [] } = useCheckInPhotosForDate(rightDate);

  const leftByType = new Map(leftPhotos.map((p) => [p.photo_type, p]));
  const rightByType = new Map(rightPhotos.map((p) => [p.photo_type, p]));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}
      <ScrollView contentContainerClassName="px-4 py-4 gap-4">
        <View className="flex-row gap-3">
          <TouchableOpacity className="flex-1" onPress={() => leftSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Date A</Text>
            <Text className="text-text-primary text-base font-medium">{leftDate}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1" onPress={() => rightSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Date B</Text>
            <Text className="text-text-primary text-base font-medium">{rightDate}</Text>
          </TouchableOpacity>
        </View>

        {PHOTO_TYPES.map(({ type, label }) => (
          <View key={type} className="gap-2">
            <Text className="text-text-primary text-sm font-semibold">{label}</Text>
            <View className="flex-row gap-3">
              <PhotoCell photoId={leftByType.get(type)?.id} />
              <PhotoCell photoId={rightByType.get(type)?.id} />
            </View>
          </View>
        ))}
      </ScrollView>

      <CalendarSheet ref={leftSheetRef} selectedDate={leftDate} onSelectDate={setLeftDate} />
      <CalendarSheet ref={rightSheetRef} selectedDate={rightDate} onSelectDate={setRightDate} />
    </View>
  );
};

export default ProgressPhotosCompareScreen;
