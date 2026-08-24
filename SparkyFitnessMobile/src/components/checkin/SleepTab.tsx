import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useCSSVariable } from 'uniwind';
import TimeSheet, { type TimeSheetRef, dateToTimeString } from '../TimeSheet';
import Button from '../ui/Button';
import Icon from '../Icon';
import { toBedtimeWakeTimeDates } from '../../utils/sleepCalculations';
import {
  useSleepEntries,
  useSaveSleepEntryMutation,
  useUpdateSleepEntryMutation,
  useDeleteSleepEntryMutation,
} from '../../hooks/useSleep';
import type { SleepEntry } from '../../services/api/sleepApi';

interface SleepTabProps {
  selectedDate: string;
}

const formatClockTime = (isoString: string) =>
  new Date(isoString).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const SleepTab: React.FC<SleepTabProps> = ({ selectedDate }) => {
  const [accentColor, dangerColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-danger',
  ]) as [string, string];

  const bedtimeSheetRef = useRef<TimeSheetRef>(null);
  const wakeTimeSheetRef = useRef<TimeSheetRef>(null);

  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  // Non-null while editing an existing entry; save routes to the update
  // mutation and clears back to the create form on success.
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useSleepEntries(selectedDate, selectedDate);
  const saveMutation = useSaveSleepEntryMutation();
  const updateMutation = useUpdateSleepEntryMutation();
  const deleteMutation = useDeleteSleepEntryMutation();

  const isSaving = saveMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setEditingId(null);
    setBedtime('');
    setWakeTime('');
  };

  const handleEdit = (entry: SleepEntry) => {
    setEditingId(entry.id);
    setBedtime(dateToTimeString(new Date(entry.bedtime)));
    setWakeTime(dateToTimeString(new Date(entry.wake_time)));
  };

  const handleSave = async () => {
    if (!bedtime || !wakeTime) {
      Toast.show({ type: 'error', text1: 'Enter both bedtime and wake time' });
      return;
    }
    const { bed, wake } = toBedtimeWakeTimeDates(selectedDate, bedtime, wakeTime);
    const durationInSeconds = Math.round((wake.getTime() - bed.getTime()) / 1000);
    const record_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          payload: { bedtime: bed.toISOString(), wake_time: wake.toISOString(), duration_in_seconds: durationInSeconds, record_timezone },
        });
        Toast.show({ type: 'success', text1: 'Sleep entry updated' });
      } else {
        await saveMutation.mutateAsync({
          entry_date: selectedDate,
          bedtime: bed.toISOString(),
          wake_time: wake.toISOString(),
          duration_in_seconds: durationInSeconds,
          record_timezone,
        });
        Toast.show({ type: 'success', text1: 'Sleep entry saved' });
      }
      resetForm();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save sleep entry' });
    }
  };

  const handleDelete = async (entry: SleepEntry) => {
    try {
      await deleteMutation.mutateAsync(entry.id);
      if (editingId === entry.id) resetForm();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not delete sleep entry' });
    }
  };

  return (
    <View className="gap-4">
      <View className="bg-surface rounded-xl p-4">
        <Text className="text-text-primary text-base font-semibold mb-3">
          {editingId ? 'Edit Sleep Entry' : 'Sleep Tracking'}
        </Text>

        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity className="flex-1" onPress={() => bedtimeSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Bedtime</Text>
            <Text className="text-text-primary text-base">{bedtime || 'Select time'}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1" onPress={() => wakeTimeSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Wake Time</Text>
            <Text className="text-text-primary text-base">{wakeTime || 'Select time'}</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2">
          <Button variant="primary" onPress={handleSave} loading={isSaving} className="flex-1">
            Save Sleep
          </Button>
          {editingId && (
            <Button variant="secondary" onPress={resetForm} disabled={isSaving}>
              Cancel
            </Button>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={accentColor} />
      ) : (
        entries.map((entry) => (
          <View key={entry.id} className="bg-surface rounded-xl p-4 flex-row items-center justify-between">
            <Text className="text-text-primary text-sm">
              {formatClockTime(entry.bedtime)} – {formatClockTime(entry.wake_time)}
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => handleEdit(entry)}
                hitSlop={8}
                accessibilityLabel="Edit sleep entry"
                testID={`edit-sleep-${entry.id}`}
              >
                <Icon name="pencil" size={18} color={accentColor} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(entry)}
                hitSlop={8}
                accessibilityLabel="Delete sleep entry"
                testID={`delete-sleep-${entry.id}`}
              >
                <Icon name="trash" size={18} color={dangerColor} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <TimeSheet ref={bedtimeSheetRef} value={bedtime} onSelectTime={setBedtime} testID="bedtime-sheet" />
      <TimeSheet ref={wakeTimeSheetRef} value={wakeTime} onSelectTime={setWakeTime} testID="waketime-sheet" />
    </View>
  );
};

export default SleepTab;
