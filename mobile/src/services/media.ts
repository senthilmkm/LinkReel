import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Alert, Share } from 'react-native';

export const MediaService = {
  /**
   * Downloads the remote MP4 from Cloud Storage and saves it to the native iOS Photos Library
   */
  async saveToCameraRoll(videoUrl: string): Promise<boolean> {
    try {
      const { status } = await requestPermissionsAsync(true);
      if (status !== 'granted') {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await this.shareVideo(videoUrl, 'Save Video');
          return true;
        }

        Alert.alert(
          'Photo Library Access Required',
          'Please enable photo library access in iOS Settings so LinkReel can save your marketing videos.',
          [{ text: 'OK' }]
        );
        return false;
      }

      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      const filename = `linkreel_${Date.now()}.mp4`;
      const fileUri = `${cacheDir}${filename}`;

      console.log(`[MediaService] Downloading ${videoUrl} to ${fileUri}...`);
      const downloadResult = await (FileSystem as any).downloadAsync(videoUrl, fileUri);
      if (!downloadResult?.uri) {
        throw new Error('Download failed. Try again.');
      }

      await Asset.create(downloadResult.uri);

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      return true;
    } catch (error: any) {
      console.error('[MediaService Save Error]', error);
      Alert.alert('Save Failed', error.message || 'Could not save video to your photo gallery.');
      return false;
    }
  },

  /**
   * Triggers the Native iOS Share Sheet allowing 1-tap direct export to TikTok, Instagram, AirDrop, Messages
   */
  async shareVideo(videoUrl: string, title: string = 'LinkReel Promo Video') {
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (isSharingAvailable) {
        const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
        const filename = `linkreel_share_${Date.now()}.mp4`;
        const fileUri = `${cacheDir}${filename}`;
        const downloadResult = await (FileSystem as any).downloadAsync(videoUrl, fileUri);

        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'video/mp4',
          dialogTitle: title,
          UTI: 'public.movie',
        });
      } else {
        await Share.share({
          title,
          message: `Check out my promotional video created with LinkReel! 🚀\n${videoUrl}`,
          url: videoUrl,
        });
      }
    } catch (error: any) {
      console.error('[MediaService Share Error]', error);
      Alert.alert('Share failed', error.message || 'Could not share that reel. Try Save to Photos instead.');
    }
  },
};
