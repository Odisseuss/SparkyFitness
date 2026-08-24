import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useCSSVariable } from 'uniwind';
import ActionSheet, { type ActionSheetRef } from '../ActionSheet';
import SafeImage from '../SafeImage';
import Icon from '../Icon';
import { pickImageFromCamera, pickImagesFromLibrary } from '../../utils/pickImage';
import {
  useCheckInPhotosForDate,
  useUploadCheckInPhotoMutation,
  useDeleteCheckInPhotoMutation,
  useCheckInPhotoImageSource,
} from '../../hooks/useCheckInPhotos';
import type { CheckInPhoto, PhotoType } from '../../services/api/checkInPhotosApi';
import type { RootStackScreenProps } from '../../types/navigation';

interface PhotosTabProps {
  selectedDate: string;
  navigation: RootStackScreenProps<'MeasurementsAdd'>['navigation'];
}

const PHOTO_TYPES: { type: PhotoType; label: string }[] = [
  { type: 'front', label: 'Front' },
  { type: 'back', label: 'Back' },
  { type: 'side', label: 'Side' },
];

const PhotoSlot: React.FC<{
  type: PhotoType;
  label: string;
  photo: CheckInPhoto | undefined;
  onPick: (type: PhotoType) => void;
  onDelete: (photo: CheckInPhoto) => void;
  isUploading: boolean;
  disabled: boolean;
}> = ({ type, label, photo, onPick, onDelete, isUploading, disabled }) => {
  const { source } = useCheckInPhotoImageSource(photo?.id);
  const [accentColor] = useCSSVariable(['--color-accent-primary']) as [string];

  return (
    <View className="flex-1 items-center gap-2">
      <Text className="text-text-secondary text-sm font-medium">{label}</Text>
      <TouchableOpacity
        onPress={() => !disabled && onPick(type)}
        disabled={disabled}
        testID={`photo-slot-${type}`}
        className="w-full aspect-[3/4] rounded-lg bg-raised items-center justify-center overflow-hidden"
      >
        {isUploading ? (
          <ActivityIndicator color={accentColor} />
        ) : source ? (
          <SafeImage source={source} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Icon name="camera" size={28} color={accentColor} />
        )}
      </TouchableOpacity>
      {photo && (
        <TouchableOpacity onPress={() => onDelete(photo)} disabled={disabled} testID={`delete-photo-${type}`}>
          <Text className="text-text-secondary text-xs">Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const PhotosTab: React.FC<PhotosTabProps> = ({ selectedDate, navigation }) => {
  const { data: photos = [], isLoading } = useCheckInPhotosForDate(selectedDate);
  const uploadMutation = useUploadCheckInPhotoMutation();
  const deleteMutation = useDeleteCheckInPhotoMutation();

  const actionSheetRef = useRef<ActionSheetRef>(null);
  const pendingType = useRef<PhotoType | null>(null);
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null);

  const photoByType = new Map(photos.map((p) => [p.photo_type, p]));

  const openPicker = (type: PhotoType) => {
    pendingType.current = type;
    actionSheetRef.current?.present();
  };

  const handlePick = async (source: 'camera' | 'library') => {
    const type = pendingType.current;
    if (!type) return;

    const result =
      source === 'camera'
        ? await pickImageFromCamera()
        : { status: 'ok' as const, image: (await pickImagesFromLibrary(1))[0] };
    if (result.status === 'denied') {
      Toast.show({ type: 'error', text1: 'Permission required' });
      return;
    }
    if (result.status === 'cancelled' || !('image' in result) || !result.image) return;

    setUploadingType(type);
    try {
      await uploadMutation.mutateAsync({ date: selectedDate, type, uri: result.image.uri });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not upload photo' });
    } finally {
      setUploadingType(null);
    }
  };

  const handleDelete = async (photo: CheckInPhoto) => {
    try {
      await deleteMutation.mutateAsync({ id: photo.id, entryDate: photo.entry_date });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not delete photo' });
    }
  };

  const anyUploading = uploadingType !== null;

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary text-base font-semibold">Progress Photos</Text>
        <TouchableOpacity
          // `ProgressPhotosCompare` is registered in a later task (Task 12); the
          // `as never` cast is the codebase's established pattern for a
          // navigate target not yet present in `RootStackParamList` (see
          // `TabsLayout.tsx`).
          onPress={() => navigation.navigate('ProgressPhotosCompare' as never)}
        >
          <Text className="text-accent-primary text-sm font-semibold">Compare</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <View className="flex-row gap-3">
          {PHOTO_TYPES.map(({ type, label }) => (
            <PhotoSlot
              key={type}
              type={type}
              label={label}
              photo={photoByType.get(type)}
              onPick={openPicker}
              onDelete={handleDelete}
              isUploading={uploadingType === type}
              disabled={anyUploading || deleteMutation.isPending}
            />
          ))}
        </View>
      )}

      <ActionSheet
        ref={actionSheetRef}
        title="Add Progress Photo"
        items={[
          { key: 'camera', label: 'Take Photo', onPress: () => handlePick('camera') },
          { key: 'library', label: 'Choose from Library', onPress: () => handlePick('library') },
        ]}
      />
    </View>
  );
};

export default PhotosTab;
