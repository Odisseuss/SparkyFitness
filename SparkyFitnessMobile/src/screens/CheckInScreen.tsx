import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import Icon from '../components/Icon';
import SegmentedControl, { type Segment } from '../components/SegmentedControl';
import CalendarSheet, { type CalendarSheetRef } from '../components/CalendarSheet';
import { FooterSaveBar } from '../components/FormScreenChrome';
import MeasurementsTab from '../components/checkin/MeasurementsTab';
import FastingMoodTab from '../components/checkin/FastingMoodTab';
import SleepTab from '../components/checkin/SleepTab';
import PhotosTab from '../components/checkin/PhotosTab';
import { formatDateLabel } from '../utils/dateUtils';
import type { RootStackScreenProps } from '../types/navigation';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader, SAVE_LABEL, SAVING_LABEL } from '../hooks/useScreenHeader';
import { useDiaryDateStore } from '../stores/diaryDateStore';

type Props = RootStackScreenProps<'MeasurementsAdd'>;

type CheckInTab = 'measurements' | 'fastingMood' | 'sleep' | 'photos';

const SEGMENTS: Segment<CheckInTab>[] = [
  { key: 'measurements', label: 'Measurements' },
  { key: 'fastingMood', label: 'Fasting & Mood' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'photos', label: 'Photos' },
];

const CheckInScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const calendarSheetRef = useRef<CalendarSheetRef>(null);

  const [accentPrimary] = useCSSVariable(['--color-accent-primary']) as [string];

  const initialDate = route.params?.date ?? useDiaryDateStore.getState().selectedDate;
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [activeTab, setActiveTab] = useState<CheckInTab>('measurements');

  // Only the Measurements tab routes through the shared header/footer Save —
  // Mood, Sleep, and Photos each own their own inline save/upload action
  // (matching web's CheckIn.tsx, where each section has its own submit
  // control rather than one page-level Save).
  const measurementsSaveRef = useRef<(() => void) | null>(null);
  const [measurementsState, setMeasurementsState] = useState({ isSaving: false, isSaveDisabled: false });

  const handleClose = () => navigation.goBack();
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    useDiaryDateStore.getState().setSelectedDate(date);
  };

  const isMeasurementsTab = activeTab === 'measurements';

  const header = useScreenHeader({
    title: 'Check-In',
    left: { kind: 'dismiss', onPress: handleClose, disabled: isMeasurementsTab && measurementsState.isSaving },
    right: isMeasurementsTab
      ? {
          kind: 'primary',
          label: SAVE_LABEL,
          busyLabel: SAVING_LABEL,
          busy: measurementsState.isSaving,
          disabled: measurementsState.isSaveDisabled,
          placement: 'native-only',
          onPress: () => measurementsSaveRef.current?.(),
          identifier: 'checkin-save',
        }
      : undefined,
  });

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}

      <TouchableOpacity
        onPress={() => calendarSheetRef.current?.present()}
        activeOpacity={0.7}
        className="flex-row items-center px-4 pt-2 pb-1"
      >
        <Text className="text-text-primary text-base">Date</Text>
        <Text className="text-accent-primary text-base font-medium mx-1.5">{formatDateLabel(selectedDate)}</Text>
        <Icon name="chevron-down" size={12} color={accentPrimary} weight="medium" />
      </TouchableOpacity>

      <View className="px-4 pb-2">
        <SegmentedControl segments={SEGMENTS} activeKey={activeTab} onSelect={setActiveTab} />
      </View>

      <View className="flex-1 px-4">
        {activeTab === 'measurements' && (
          <MeasurementsTab
            selectedDate={selectedDate}
            registerSaveHandler={(fn) => {
              measurementsSaveRef.current = fn;
            }}
            onStateChange={setMeasurementsState}
          />
        )}
        {activeTab === 'fastingMood' && <FastingMoodTab selectedDate={selectedDate} navigation={navigation} />}
        {activeTab === 'sleep' && <SleepTab selectedDate={selectedDate} />}
        {activeTab === 'photos' && <PhotosTab selectedDate={selectedDate} navigation={navigation} />}
      </View>

      {!usesNativeHeader && isMeasurementsTab && (
        <FooterSaveBar
          onPress={() => measurementsSaveRef.current?.()}
          disabled={measurementsState.isSaveDisabled}
          busy={measurementsState.isSaving}
        />
      )}

      <CalendarSheet ref={calendarSheetRef} selectedDate={selectedDate} onSelectDate={handleSelectDate} />
    </View>
  );
};

export default CheckInScreen;
