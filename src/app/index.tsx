import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { Plus, BookOpen, Trash2, Clock, CheckCircle2, Sparkles, Flame, X, Search } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ReaderModal from '@/components/reader-modal';
import BookMenuModal from '@/components/book-menu-modal';
import {
  Book,
  loadBooks,
  importBook,
  deleteBook,
  updateBookProgress,
  fetchBookMetadataFromAPI,
  updateBookMetadata,
  getStreakData,
  setDailyGoal,
  ReadingStreakData,
} from '../utils/pdf-handler';
import { Spacing, Colors } from '../constants/theme';
import { useFocusEffect } from 'expo-router';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const activeColors = Colors[scheme === 'unspecified' || !scheme ? 'light' : scheme];
  
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readerVisible, setReaderVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [autoPlaySpeech, setAutoPlaySpeech] = useState(false);
  
  const [streakData, setStreakData] = useState<ReadingStreakData | null>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);

  // Metadata Correction Modal states
  const [metadataModalVisible, setMetadataModalVisible] = useState(false);
  const [metadataSearchQuery, setMetadataSearchQuery] = useState('');
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataBookTarget, setMetadataBookTarget] = useState<Book | null>(null);

  const [editableTitle, setEditableTitle] = useState('');
  const [editableAuthor, setEditableAuthor] = useState('');
  const [editableCoverUrl, setEditableCoverUrl] = useState<string | undefined>(undefined);
  const [editableWorkKey, setEditableWorkKey] = useState<string | undefined>(undefined);

  // Reload books and check reading goals when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchBooks();
      checkReadingGoal();
    }, [])
  );

  const fetchBooks = async () => {
    setLoading(true);
    const loadedBooks = await loadBooks();
    setBooks(loadedBooks);
    setLoading(false);
  };

  const checkReadingGoal = async () => {
    const data = await getStreakData();
    setStreakData(data);
    
    // If no goal set for today, show the goal selector modal!
    if (data.goalMinutes === 0) {
      setGoalModalVisible(true);
    }
  };

  const handleSelectGoal = async (minutes: number) => {
    const updated = await setDailyGoal(minutes);
    setStreakData(updated);
    setGoalModalVisible(false);
    Alert.alert('Meta Guardada 🎯', `Te has propuesto leer ${minutes} minutos hoy. ¡Disfruta la lectura!`);
  };

  const handleImportBook = async () => {
    try {
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newBook = await importBook(asset.uri, asset.name);
        
        if (newBook) {
          Alert.alert('Éxito', `"${newBook.title}" se agregó a tu biblioteca.`);
          await fetchBooks();
        } else {
          Alert.alert('Error', 'No se pudo importar el libro. Asegúrate de que sea un PDF válido.');
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Ocurrió un error al importar el archivo.');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteBook = (book: Book) => {
    Alert.alert(
      'Eliminar libro',
      `¿Estás seguro de que deseas eliminar "${book.title}" de tu biblioteca?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteBook(book.id, book.localUri);
            if (success) {
              await fetchBooks();
            } else {
              Alert.alert('Error', 'No se pudo eliminar el archivo local.');
            }
          },
        },
      ]
    );
  };

  const handleAutoCorrectMetadata = async (book: Book) => {
    setMetadataBookTarget(book);
    const initialQuery = book.title.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
    setMetadataSearchQuery(initialQuery);
    
    // Pre-fill editable states with current details
    setEditableTitle(book.title);
    setEditableAuthor(book.author || 'Autor Desconocido');
    setEditableCoverUrl(book.coverUrl);
    setEditableWorkKey(book.workKey);
    
    setMetadataModalVisible(true);
    
    // Automatically trigger search for the cleaned filename
    handleMetadataSearch(initialQuery);
  };

  const handleMetadataSearch = async (query: string) => {
    if (!query.trim()) return;
    setMetadataLoading(true);
    try {
      const result = await fetchBookMetadataFromAPI(query);
      if (result) {
        setEditableTitle(result.title);
        setEditableAuthor(result.author);
        setEditableCoverUrl(result.coverUrl);
        setEditableWorkKey(result.workKey);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo obtener la información.');
    } finally {
      setMetadataLoading(false);
    }
  };

  const handlePickCoverImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setEditableCoverUrl(selectedUri);
      }
    } catch (err) {
      console.error('Error picking cover image:', err);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const handleApplyMetadata = async () => {
    if (!metadataBookTarget) return;
    
    // If the cover URL changed, save it locally for offline access
    let finalCoverUrl = editableCoverUrl;
    if (editableCoverUrl && editableCoverUrl !== metadataBookTarget.coverUrl) {
      try {
        setImporting(true);
        const coverFilename = `${metadataBookTarget.id}_cover.jpg`;
        const coverDest = `${FileSystem.documentDirectory}books/${coverFilename}`;
        
        if (editableCoverUrl.startsWith('file://')) {
          // Copy manually picked local gallery image from cache to books folder
          await FileSystem.copyAsync({
            from: editableCoverUrl,
            to: coverDest,
          });
          finalCoverUrl = coverDest;
        } else {
          // Download remote image search result
          const downloadResult = await FileSystem.downloadAsync(editableCoverUrl, coverDest);
          finalCoverUrl = downloadResult.uri;
        }
      } catch (err) {
        console.error('Error saving new cover:', err);
      }
    }

    try {
      setImporting(true);
      const updatedBooks = await updateBookMetadata(metadataBookTarget.id, {
        title: editableTitle.trim() || metadataBookTarget.title,
        author: editableAuthor.trim() || 'Autor Desconocido',
        coverUrl: finalCoverUrl,
        workKey: editableWorkKey,
      });
      setBooks(updatedBooks);
      setMetadataModalVisible(false);
      Alert.alert('Éxito', 'Se actualizó la información de tu libro.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'No se pudieron guardar los cambios.');
    } finally {
      setImporting(false);
    }
  };

  const handleOpenBook = (book: Book) => {
    setSelectedBook(book);
    setMenuVisible(true);
  };

  const onStartReading = () => {
    setMenuVisible(false);
    setAutoPlaySpeech(false);
    setReaderVisible(true);
  };

  const onStartAudiobook = () => {
    setMenuVisible(false);
    setAutoPlaySpeech(true);
    setReaderVisible(true);
  };

  const handleProgressUpdate = async (bookId: string, page: number, totalPages: number) => {
    const updatedBooks = await updateBookProgress(bookId, page, totalPages);
    setBooks(updatedBooks);
    // Sync current selected book object too
    if (selectedBook && selectedBook.id === bookId) {
      const match = updatedBooks.find(b => b.id === bookId);
      if (match) setSelectedBook(match);
    }
  };

  const renderBookItem = ({ item }: { item: Book }) => {
    const progressPercent = Math.round(item.progress * 100);
    const isFinished = item.progress >= 1.0;

    return (
      <ThemedView type="backgroundElement" style={styles.bookCard}>
        <TouchableOpacity style={styles.cardPressable} onPress={() => handleOpenBook(item)}>
          {/* COVER */}
          {item.coverUrl ? (
            <Image
              source={{ uri: item.coverUrl }}
              style={styles.bookCoverImage}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={[styles.bookCover, { backgroundColor: item.coverColor }]}>
              <ThemedText style={styles.coverInitials}>
                {item.initials}
              </ThemedText>
              <View style={styles.coverDecoration} />
            </View>
          )}

          {/* METADATA */}
          <View style={styles.bookDetails}>
            <ThemedText type="smallBold" numberOfLines={2} style={styles.bookTitle}>
              {item.title}
            </ThemedText>
            <ThemedText type="code" style={{ fontSize: 11, color: activeColors.textSecondary, marginBottom: Spacing.half }}>
              {item.author || 'Autor Desconocido'}
            </ThemedText>

            <View style={styles.progressRow}>
              <ThemedText type="code" style={styles.progressText}>
                {isFinished ? 'Terminado' : `Pág. ${item.lastPage} de ${item.totalPages}`}
              </ThemedText>
              <ThemedText type="code" style={styles.progressText}>
                {progressPercent}%
              </ThemedText>
            </View>

            {/* PROGRESS BAR */}
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

            {/* STATUS ROW */}
            <View style={styles.statusRow}>
              <View style={styles.iconWithText}>
                {isFinished ? (
                  <CheckCircle2 color="#10B981" size={14} />
                ) : (
                  <Clock color={activeColors.textSecondary} size={14} />
                )}
                <ThemedText type="code" style={[styles.statusLabel, { color: isFinished ? '#10B981' : activeColors.textSecondary }]}>
                  {isFinished ? 'Leído' : 'Leyendo'}
                </ThemedText>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ACTIONS SECTION */}
        <View style={[styles.cardActions, { borderLeftColor: activeColors.backgroundSelected }]}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleAutoCorrectMetadata(item)}>
            <Sparkles color="#4F46E5" size={18} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteBook(item)}>
            <Trash2 color="#EF4444" size={18} />
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* TITLE BAR */}
        <View style={styles.titleBar}>
          <View style={[styles.titleRow, { justifyContent: 'space-between', alignItems: 'center', width: '100%', flexDirection: 'row' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <BookOpen color="#4F46E5" size={28} />
              <ThemedText type="subtitle" style={[styles.appTitle, { marginLeft: 8 }]}>
                Mi Biblioteca
              </ThemedText>
            </View>

            {/* STREAK BADGE */}
            {streakData && streakData.streakCount > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                <Flame color="#F59E0B" size={16} fill="#F59E0B" style={{ marginRight: 4 }} />
                <ThemedText type="code" style={styles.streakBadgeText}>
                  {streakData.streakCount} {streakData.streakCount === 1 ? 'día' : 'días'}
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText type="code" style={styles.subtitle}>
            Tu espacio de lectura y aprendizaje inteligente
          </ThemedText>
        </View>

        {/* BOOKS LIST */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <ThemedText type="code" style={styles.loaderText}>
              Cargando biblioteca...
            </ThemedText>
          </View>
        ) : books.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BookOpen color={activeColors.textSecondary} size={64} strokeWidth={1} />
            <ThemedText type="default" style={styles.emptyText}>
              Tu biblioteca está vacía.
            </ThemedText>
            <ThemedText type="code" style={styles.emptySubText}>
              Presiona el botón "+" para importar tu primer libro PDF.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item.id}
            renderItem={renderBookItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* IMPORT LOADER OVERLAY */}
        {importing && (
          <View style={styles.overlayLoader}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <ThemedText type="code" style={styles.overlayText}>
              Importando libro...
            </ThemedText>
          </View>
        )}

        {/* FLOATING ACTION BUTTON */}
        <TouchableOpacity style={styles.fab} onPress={handleImportBook} disabled={importing}>
          <Plus color="#FFFFFF" size={28} />
        </TouchableOpacity>

        {/* READER MODAL */}
        <ReaderModal
          visible={readerVisible}
          book={selectedBook}
          autoPlaySpeech={autoPlaySpeech}
          onClose={() => {
            setReaderVisible(false);
            setSelectedBook(null);
            setAutoPlaySpeech(false);
            fetchBooks();
          }}
          onProgressUpdate={handleProgressUpdate}
        />

        {/* BOOK MENU DETAILS MODAL */}
        <BookMenuModal
          visible={menuVisible}
          book={selectedBook}
          onClose={() => {
            setMenuVisible(false);
            setSelectedBook(null);
          }}
          onStartReading={onStartReading}
          onStartAudiobook={onStartAudiobook}
          onBookshelfUpdate={fetchBooks}
        />

        {/* DAILY READING GOAL PROMPT MODAL */}
        <Modal
          visible={goalModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setGoalModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <ThemedView type="card" style={styles.goalCard}>
              <View style={styles.goalIconContainer}>
                <Flame color="#F59E0B" size={40} fill="#F59E0B" />
              </View>
              
              <ThemedText type="subtitle" style={styles.goalTitle}>
                Establece tu Meta Diaria 🎯
              </ThemedText>
              
              <ThemedText type="code" style={styles.goalDescription}>
                Para activar y acumular tu racha de lectura, ¿cuántos minutos te propones leer hoy?
              </ThemedText>

              {/* QUICK OPTIONS */}
              <View style={styles.goalOptionsContainer}>
                <TouchableOpacity style={styles.goalOptionBtn} onPress={() => handleSelectGoal(5)}>
                  <ThemedText type="smallBold" style={styles.goalOptionText}>5 min (Rápido)</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.goalOptionBtn} onPress={() => handleSelectGoal(10)}>
                  <ThemedText type="smallBold" style={styles.goalOptionText}>10 min (Moderado)</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.goalOptionBtn, { backgroundColor: '#4F46E5' }]} onPress={() => handleSelectGoal(15)}>
                  <ThemedText type="smallBold" style={[styles.goalOptionText, { color: '#FFFFFF' }]}>15 min (Recomendado)</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.goalOptionBtn} onPress={() => handleSelectGoal(30)}>
                  <ThemedText type="smallBold" style={styles.goalOptionText}>30 min (Lector asiduo)</ThemedText>
                </TouchableOpacity>
              </View>


            </ThemedView>
          </View>
        </Modal>

        {/* METADATA CORRECTION MODAL */}
        <Modal
          visible={metadataModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setMetadataModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <ThemedView type="card" style={styles.metadataCard}>
              {/* Header */}
              <View style={styles.metadataHeader}>
                <ThemedText type="subtitle" style={styles.metadataTitle}>
                  Corregir Información
                </ThemedText>
                <TouchableOpacity onPress={() => setMetadataModalVisible(false)} style={styles.closeBtn}>
                  <X color={activeColors.textSecondary} size={20} />
                </TouchableOpacity>
              </View>

              <ThemedText type="code" style={styles.metadataDesc}>
                Escribe el título correcto del libro para buscar su información real y portada:
              </ThemedText>

              {/* Search input row */}
              <View style={styles.searchRow}>
                <TextInput
                  placeholder="Escribe título o autor..."
                  placeholderTextColor={activeColors.textSecondary}
                  value={metadataSearchQuery}
                  onChangeText={setMetadataSearchQuery}
                  onSubmitEditing={() => handleMetadataSearch(metadataSearchQuery)}
                  style={[styles.searchInput, { color: activeColors.text, borderColor: activeColors.border, backgroundColor: activeColors.background }]}
                />
                <TouchableOpacity 
                  style={[styles.searchBtn, { backgroundColor: '#4F46E5' }]}
                  onPress={() => handleMetadataSearch(metadataSearchQuery)}>
                  <Search color="#FFFFFF" size={16} />
                </TouchableOpacity>
              </View>

              {/* Result Area */}
              <View style={styles.resultContainer}>
                {metadataLoading ? (
                  <View style={styles.centerSpinner}>
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <ThemedText type="code" style={{ fontSize: 10, color: activeColors.textSecondary, marginTop: 6 }}>
                      Buscando en OpenLibrary...
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.resultBoxVertical}>
                    {/* Centered Cover Preview */}
                    <View style={styles.coverPreviewContainer}>
                      <TouchableOpacity 
                        style={[styles.coverPreviewLarge, { backgroundColor: '#4F46E510', borderColor: activeColors.border }]}
                        onPress={handlePickCoverImage}>
                        {editableCoverUrl ? (
                          <Image 
                            source={{ uri: editableCoverUrl }} 
                            style={styles.coverPreviewImgLarge}
                            contentFit="cover"
                          />
                        ) : (
                          <BookOpen color="#4F46E5" size={32} />
                        )}
                        <View style={styles.coverChangeOverlay}>
                          <ThemedText type="code" style={styles.coverChangeText}>CAMBIAR</ThemedText>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Inputs stacked vertically taking 100% width */}
                    <View style={styles.formContainer}>
                      <ThemedText type="code" style={styles.formLabel}>
                        Título del libro
                      </ThemedText>
                      <TextInput
                        value={editableTitle}
                        onChangeText={setEditableTitle}
                        placeholder="Escribe el título..."
                        placeholderTextColor={activeColors.textSecondary}
                        style={[styles.editableFormInputLarge, { color: activeColors.text, borderColor: activeColors.border, backgroundColor: activeColors.background }]}
                      />
                      
                      <ThemedText type="code" style={styles.formLabel}>
                        Autor
                      </ThemedText>
                      <TextInput
                        value={editableAuthor}
                        onChangeText={setEditableAuthor}
                        placeholder="Escribe el autor..."
                        placeholderTextColor={activeColors.textSecondary}
                        style={[styles.editableFormInputLarge, { color: activeColors.text, borderColor: activeColors.border, backgroundColor: activeColors.background }]}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity 
                  style={[styles.cancelBtn, { borderColor: activeColors.border }]} 
                  onPress={() => setMetadataModalVisible(false)}>
                  <ThemedText type="smallBold" style={{ color: activeColors.textSecondary }}>Rechazar</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  disabled={metadataLoading}
                  style={[
                    styles.applyBtn, 
                    { backgroundColor: metadataLoading ? '#A5B4FC' : '#4F46E5' }
                  ]} 
                  onPress={handleApplyMetadata}>
                  <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>Aceptar</ThemedText>
                </TouchableOpacity>
              </View>

            </ThemedView>
          </View>
        </Modal>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  titleBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: '#6E6E73',
    marginTop: Spacing.half,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 100, // Safe padding for FAB
  },
  bookCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookCover: {
    width: 60,
    height: 85,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  bookCoverImage: {
    width: 60,
    height: 85,
    borderRadius: 8,
    backgroundColor: '#EEE',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  coverInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  coverDecoration: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  bookDetails: {
    flex: 1,
    marginLeft: Spacing.three,
    paddingRight: Spacing.two,
  },
  bookTitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: Spacing.one,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.half,
  },
  progressText: {
    fontSize: 10,
    color: '#8E8E93',
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
  statusRow: {
    flexDirection: 'row',
    marginTop: Spacing.two,
  },
  iconWithText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardActions: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.two,
    borderLeftWidth: 1,
  },
  actionButton: {
    padding: 6,
    borderRadius: 8,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: Spacing.two,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  overlayLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  overlayText: {
    marginTop: Spacing.two,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  streakBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  goalCard: {
    width: '100%',
    maxWidth: 320,
    padding: Spacing.four,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  goalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F59E0B15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  goalTitle: {
    textAlign: 'center',
    marginBottom: Spacing.two,
    fontWeight: '800',
  },
  goalDescription: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: Spacing.four,
  },
  goalOptionsContainer: {
    width: '100%',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  goalOptionBtn: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.15)',
    alignItems: 'center',
  },
  goalOptionText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
  metadataCard: {
    width: '100%',
    maxWidth: 320,
    padding: Spacing.four,
    borderRadius: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  metadataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  metadataTitle: {
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  metadataDesc: {
    color: '#8E8E93',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: Spacing.three,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContainer: {
    minHeight: 80,
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  centerSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  resultBoxVertical: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.two,
  },
  coverPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.one,
  },
  coverPreviewLarge: {
    width: 75,
    height: 105,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  coverPreviewImgLarge: {
    width: 75,
    height: 105,
  },
  coverChangeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverChangeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  formContainer: {
    width: '100%',
    gap: Spacing.one,
  },
  formLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2,
  },
  editableFormInputLarge: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 13,
    width: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

