import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { X, BookOpen, Volume2, Sparkles, AlertCircle } from 'lucide-react-native';
import { Image } from 'expo-image';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Book, fetchSynopsisFromAPI, generateLocalSynopsis, saveBookSynopsis } from '../utils/pdf-handler';
import { Colors, Spacing } from '../constants/theme';

interface BookMenuModalProps {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  onStartReading: () => void;
  onStartAudiobook: () => void;
  onBookshelfUpdate: () => void;
}

export default function BookMenuModal({
  visible,
  book,
  onClose,
  onStartReading,
  onStartAudiobook,
  onBookshelfUpdate,
}: BookMenuModalProps) {
  const scheme = useColorScheme();
  const activeColors = Colors[scheme === 'unspecified' || !scheme ? 'light' : scheme];

  const [synopsis, setSynopsis] = useState<string>('');
  const [loadingSynopsis, setLoadingSynopsis] = useState(false);

  useEffect(() => {
    if (visible && book) {
      if (book.synopsis) {
        setSynopsis(book.synopsis);
      } else {
        loadSynopsis();
      }
    }
  }, [visible, book]);

  if (!book) return null;

  const loadSynopsis = async () => {
    try {
      setLoadingSynopsis(true);
      setSynopsis('');
      
      // Call OpenLibrary API to fetch description
      const fetched = await fetchSynopsisFromAPI(book.title, book.workKey);
      
      // Fallback to local AI generator if not found in API
      const finalSynopsis = fetched.trim() || generateLocalSynopsis(book.title, book.author);
      
      // Save permanently in metadata
      await saveBookSynopsis(book.id, finalSynopsis);
      setSynopsis(finalSynopsis);
      onBookshelfUpdate(); // Tell parent list to refresh data
    } catch (e) {
      console.error(e);
      setSynopsis(generateLocalSynopsis(book.title, book.author));
    } finally {
      setLoadingSynopsis(false);
    }
  };

  const progressPercent = Math.round(book.progress * 100);
  const isFinished = book.progress >= 1.0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.modalContainer}>
          
          {/* CLOSE HEADER */}
          <View style={styles.header}>
            <ThemedText type="code" style={styles.headerLabel}>
              Detalles del Libro
            </ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={activeColors.text} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            
            {/* BOOK VISUAL META */}
            <View style={styles.bookHero}>
              {book.coverUrl ? (
                <Image
                  source={{ uri: book.coverUrl }}
                  style={styles.bookCover}
                  contentFit="cover"
                  transition={300}
                />
              ) : (
                <View style={[styles.bookCoverPlaceholder, { backgroundColor: book.coverColor }]}>
                  <ThemedText style={styles.coverInitials}>
                    {book.initials}
                  </ThemedText>
                  <View style={styles.coverDecoration} />
                </View>
              )}

              <View style={styles.bookMainMeta}>
                <ThemedText type="default" style={styles.title} numberOfLines={3}>
                  {book.title}
                </ThemedText>
                <ThemedText type="code" style={[styles.author, { color: activeColors.textSecondary }]}>
                  {book.author || 'Autor Desconocido'}
                </ThemedText>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressTextRow}>
                    <ThemedText type="code" style={{ fontSize: 10, color: activeColors.textSecondary }}>
                      Progreso: {progressPercent}%
                    </ThemedText>
                    <ThemedText type="code" style={{ fontSize: 10, color: activeColors.textSecondary }}>
                      {isFinished ? 'Terminado' : `Pág. ${book.lastPage} de ${book.totalPages}`}
                    </ThemedText>
                  </View>
                  <View style={[styles.progressBarBg, { backgroundColor: activeColors.backgroundSelected }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: isFinished ? '#10B981' : '#4F46E5',
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: activeColors.backgroundSelected }]} />

            {/* AI SYNOPSIS SECTION */}
            <View style={styles.synopsisSection}>
              <View style={styles.sectionHeader}>
                <Sparkles color="#4F46E5" size={18} />
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  Sinopsis de la IA
                </ThemedText>
              </View>

              {loadingSynopsis ? (
                <View style={styles.loaderBox}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <ThemedText type="code" style={styles.loaderText}>
                    La IA está analizando el libro...
                  </ThemedText>
                </View>
              ) : (
                <ThemedView type="backgroundSelected" style={styles.synopsisBox}>
                  <ThemedText style={styles.synopsisText}>
                    {synopsis}
                  </ThemedText>
                </ThemedView>
              )}
            </View>

          </ScrollView>

          {/* ACTION BUTTONS */}
          <View style={[styles.footer, { borderTopColor: activeColors.backgroundSelected }]}>
            <TouchableOpacity style={styles.readBtn} onPress={onStartReading}>
              <BookOpen color="#FFFFFF" size={20} />
              <ThemedText type="smallBold" style={styles.btnText}>
                Leer Libro
              </ThemedText>
            </TouchableOpacity>
          </View>

        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: Dimensions.get('window').height * 0.75, // Take 75% height
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
  },
  headerLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  bookHero: {
    flexDirection: 'row',
    paddingVertical: Spacing.three,
    gap: Spacing.four,
  },
  bookCover: {
    width: 100,
    height: 145,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  bookCoverPlaceholder: {
    width: 100,
    height: 145,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  coverInitials: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  coverDecoration: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  bookMainMeta: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  author: {
    fontSize: 13,
  },
  progressContainer: {
    marginTop: Spacing.two,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  synopsisSection: {
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
  },
  loaderBox: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loaderText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  synopsisBox: {
    padding: Spacing.three,
    borderRadius: 12,
  },
  synopsisText: {
    fontSize: 14,
    lineHeight: 22,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: Spacing.three,
    gap: Spacing.one,
  },
  alertText: {
    fontSize: 11,
    color: '#4F46E5',
    flex: 1,
  },
  footer: {
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  readBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 2,
  },
  listenBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#10B981',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 2,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
