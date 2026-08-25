import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  BUILT_IN_MOODS,
  moodValueToTag,
  type MoodDef,
} from '@workspace/shared';
import { useCSSVariable } from 'uniwind';
import FastingCard from '../FastingCard';
import Button from '../ui/Button';
import MoodSlider from './MoodSlider';
import { useMoodForDate, useSaveMoodMutation } from '../../hooks/useMood';
import type { RootStackScreenProps } from '../../types/navigation';

interface FastingMoodTabProps {
  selectedDate: string;
  navigation: RootStackScreenProps<'MeasurementsAdd'>['navigation'];
}

// Mood intensity is a 0-100 scale (kept for interop/analytics); the mobile
// form only exposes the 10-100 range in steps of 5, matching web's MoodMeter
// slider bounds.
const MOOD_MIN = 10;
const MOOD_MAX = 100;
const MOOD_STEP = 5;
const DEFAULT_MOOD = 50;

const FastingMoodTab: React.FC<FastingMoodTabProps> = ({
  selectedDate,
  navigation,
}) => {
  const [accentColor, mutedColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];

  const { data: existingMood, isLoading } = useMoodForDate(selectedDate);
  const saveMoodMutation = useSaveMoodMutation();

  // Lazily seeded from whatever `existingMood` already resolved to on this
  // first render (e.g. a cached TanStack Query result — the default
  // `staleTime` here is Infinity, so revisiting a previously-viewed date
  // serves cached data synchronously with `isLoading: false` on mount).
  // Seeding from hardcoded defaults instead would disagree with
  // `prevExistingMood`'s initial value below and silently hide the user's
  // real saved entry behind the defaults with no loading spinner to hint at
  // it. Mirrors the `measurementsSnapshot` seeding in MeasurementsTab.tsx.
  const [mood, setMood] = useState(() =>
    existingMood ? existingMood.mood_value : DEFAULT_MOOD,
  );
  const [moodTags, setMoodTags] = useState<string[]>(() =>
    existingMood ? existingMood.mood_tags : [],
  );
  const [notes, setNotes] = useState(() =>
    existingMood ? existingMood.notes : '',
  );

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

  // Tags are purely descriptive labels and must never affect the intensity
  // slider — mirrors web's MoodMeter, where the tag chips and the slider are
  // independent controls.
  const toggleTag = (m: MoodDef) => {
    const wasSelected = moodTags.includes(m.name);
    setMoodTags(prev =>
      wasSelected ? prev.filter(t => t !== m.name) : [...prev, m.name],
    );
  };

  const handleSave = async () => {
    try {
      await saveMoodMutation.mutateAsync({
        mood_value: mood,
        mood_tags: moodTags,
        notes,
        entry_date: selectedDate,
      });
      Toast.show({ type: 'success', text1: 'Mood saved' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save mood' });
    }
  };

  const currentBandName = moodValueToTag(mood);
  const currentBandMood = BUILT_IN_MOODS.find(m => m.name === currentBandName);

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
      <FastingCard
        navigation={
          navigation as unknown as React.ComponentProps<
            typeof FastingCard
          >['navigation']
        }
      />

      <View className="bg-surface rounded-xl p-4">
        <Text className="text-text-primary text-base font-semibold mb-3">
          How are you feeling today?
        </Text>

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
            <View className="mb-4">
              <MoodSlider
                value={mood}
                min={MOOD_MIN}
                max={MOOD_MAX}
                step={MOOD_STEP}
                onValueChange={setMood}
                emoji={currentBandMood?.emoji ?? ''}
                accessibilityLabel="Overall mood"
              />
            </View>

            <View className="flex-row flex-wrap gap-2 mb-4">
              {BUILT_IN_MOODS.map(m => {
                const active = moodTags.includes(m.name);
                return (
                  <TouchableOpacity
                    key={m.name}
                    onPress={() => toggleTag(m)}
                    className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
                      active ? 'bg-accent-primary' : 'bg-raised'
                    }`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text>{m.emoji}</Text>
                    <Text
                      className={`text-sm ${
                        active ? 'text-white font-semibold' : 'text-text-muted'
                      }`}
                    >
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

            <Button
              variant="primary"
              onPress={handleSave}
              loading={saveMoodMutation.isPending}
            >
              Save Mood
            </Button>
          </>
        )}
      </View>
    </View>
  );
};

export default FastingMoodTab;
