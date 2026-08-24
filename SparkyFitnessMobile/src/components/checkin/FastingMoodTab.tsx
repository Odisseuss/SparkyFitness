import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { BUILT_IN_MOODS, moodValueToTag, type MoodDef } from '@workspace/shared';
import { useCSSVariable } from 'uniwind';
import FastingCard from '../FastingCard';
import Button from '../ui/Button';
import StepperInput, { useStepperDraft } from '../StepperInput';
import { useMoodForDate, useSaveMoodMutation } from '../../hooks/useMood';
import type { RootStackScreenProps } from '../../types/navigation';

interface FastingMoodTabProps {
  selectedDate: string;
  navigation: RootStackScreenProps<'MeasurementsAdd'>['navigation'];
}

// Mood intensity is a 0-100 scale (kept for interop/analytics); the mobile
// form only exposes the 10-100 range in steps of 5 so a stepper tap always
// lands on a meaningful value (mirrors the cycle-length/period-length
// StepperInput usage in CycleOnboardingScreen).
const MOOD_MIN = 10;
const MOOD_MAX = 100;
const MOOD_STEP = 5;
const DEFAULT_MOOD = 50;

const FastingMoodTab: React.FC<FastingMoodTabProps> = ({ selectedDate, navigation }) => {
  const [accentColor, mutedColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];

  const { data: existingMood, isLoading } = useMoodForDate(selectedDate);
  const saveMoodMutation = useSaveMoodMutation();

  const [mood, setMood] = useState(DEFAULT_MOOD);
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Re-seed the form whenever the loaded entry for this date changes (date
  // switch, or the query settling after a save). A dirty-tracking guard is
  // unnecessary here: unlike Measurements, this form has no server-refetch
  // race to protect against — it only ever loads once per date on mount.
  // Adjusted directly during render (React's "adjusting state when a prop
  // changes" pattern) rather than in an effect, so the re-seed lands in the
  // same commit as the data change instead of a follow-up render.
  const [prevExistingMood, setPrevExistingMood] = useState(existingMood);
  if (existingMood !== prevExistingMood) {
    setPrevExistingMood(existingMood);
    if (existingMood) {
      setMood(existingMood.mood_value);
      setMoodTags(existingMood.mood_tags);
      setNotes(existingMood.notes);
    } else {
      setMood(DEFAULT_MOOD);
      setMoodTags([]);
      setNotes('');
    }
  }

  const moodStepperProps = useStepperDraft({
    value: mood,
    min: MOOD_MIN,
    max: MOOD_MAX,
    step: MOOD_STEP,
    onCommit: setMood,
  });

  // Toggles the descriptive tag; for the nine banded moods it also jumps the
  // intensity stepper to that band's value, giving a one-tap way to set both
  // the overall rating and a matching tag without the removed slider. The
  // jump only happens on selection (not-selected -> selected); deselecting
  // an already-selected chip must not re-snap the intensity, since the user
  // may have since moved the stepper to a different value manually.
  const toggleTag = (m: MoodDef) => {
    const wasSelected = moodTags.includes(m.name);
    setMoodTags((prev) => (wasSelected ? prev.filter((t) => t !== m.name) : [...prev, m.name]));
    if (!wasSelected && m.band != null) setMood(m.band);
  };

  const handleSave = async () => {
    try {
      await saveMoodMutation.mutateAsync({ mood_value: mood, mood_tags: moodTags, notes, entry_date: selectedDate });
      Toast.show({ type: 'success', text1: 'Mood saved' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save mood' });
    }
  };

  const currentBandName = moodValueToTag(mood);
  const currentBandMood = BUILT_IN_MOODS.find((m) => m.name === currentBandName);

  return (
    <View className="gap-4">
      {/*
        FastingCard's navigation prop is typed as a Dashboard-tab composite
        navigation prop (it also needs BottomTabNavigationProp<TabParamList>
        methods like jumpTo), but this tab is reached from the root-stack-only
        MeasurementsAdd screen. FastingCard only ever calls
        `navigation.navigate('FastingDetail')`, a method our stack navigation
        prop already has, so the cast is safe at runtime; it only exists to
        satisfy the wider composite type FastingCard declares for its
        Dashboard usage.
      */}
      <FastingCard navigation={navigation as unknown as React.ComponentProps<typeof FastingCard>['navigation']} />

      <View className="bg-surface rounded-xl p-4">
        <Text className="text-text-primary text-base font-semibold mb-3">How are you feeling today?</Text>

        {isLoading ? (
          <ActivityIndicator color={accentColor} />
        ) : (
          <>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-text-secondary text-sm">Overall mood</Text>
              <Text className="text-text-primary text-sm font-medium">
                {currentBandMood?.emoji} {currentBandMood?.displayName}
              </Text>
            </View>
            <View className="items-center mb-4">
              <StepperInput
                {...moodStepperProps}
                keyboardType="number-pad"
                inputProps={{ accessibilityLabel: 'Overall mood' }}
              />
            </View>

            <View className="flex-row flex-wrap gap-2 mb-4">
              {BUILT_IN_MOODS.map((m) => {
                const active = moodTags.includes(m.name);
                return (
                  <TouchableOpacity
                    key={m.name}
                    onPress={() => toggleTag(m)}
                    className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${active ? 'bg-accent-primary' : 'bg-raised'}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text>{m.emoji}</Text>
                    <Text className={`text-sm ${active ? 'text-white font-semibold' : 'text-text-muted'}`}>
                      {m.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any thoughts or feelings you'd like to add?"
              placeholderTextColor={mutedColor}
              multiline
              className="text-text-primary border border-border-subtle rounded-lg p-3 min-h-20 mb-4"
              textAlignVertical="top"
            />

            <Button variant="primary" onPress={handleSave} loading={saveMoodMutation.isPending}>
              Save Mood
            </Button>
          </>
        )}
      </View>
    </View>
  );
};

export default FastingMoodTab;
