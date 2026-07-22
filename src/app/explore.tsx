import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useColorScheme,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Award,
  BookOpen,
  Flame,
  Sparkles,
  HelpCircle,
  Clock,
  BookOpenCheck,
  ArrowLeft,
} from 'lucide-react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ReaderModal from '@/components/reader-modal';
import { loadBooks, Book, getStreakData, ReadingStreakData, updateBookProgress } from '../utils/pdf-handler';
import { Colors, Spacing, BottomTabInset, MaxContentWidth } from '../constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFocusEffect } from 'expo-router';

export default function ExploreScreen() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const activeColors = Colors[scheme === 'unspecified' || !scheme ? 'light' : scheme];
  const safeAreaInsets = useSafeAreaInsets();
  
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [streakData, setStreakData] = useState<ReadingStreakData | null>(null);
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readerVisible, setReaderVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchStats();
    }, [])
  );

  const fetchStats = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const loadedBooks = await loadBooks();
    setBooks(loadedBooks);
    const streak = await getStreakData();
    setStreakData(streak);
    if (showLoading) setLoading(false);
  };

  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    ios: {
      paddingTop: safeAreaInsets.top,
      paddingLeft: safeAreaInsets.left,
      paddingRight: safeAreaInsets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  // Calculate statistics
  const totalBooks = books.length;
  const completedBooks = books.filter((b) => b.progress >= 0.99 || b.lastPage >= b.totalPages);
  const finishedBooks = completedBooks.length;
  const inProgressBooks = books.filter((b) => b.progress > 0.0 && b.progress < 1.0).length;
  
  // Calculate simulated reading time (15 mins per 10% progress of any book)
  const totalReadingMinutes = Math.round(
    books.reduce((acc, b) => acc + ((b.progress ?? 0) * ((b.totalPages || 10) * 1.5)), 0)
  );

  const dailyGoalMinutes = streakData?.goalMinutes || 15;
  const currentDailyMinutes = Math.floor((streakData?.todaySecondsRead || 0) / 60);
  const dailyProgressPercent = dailyGoalMinutes > 0 ? Math.min(100, Math.round((currentDailyMinutes / dailyGoalMinutes) * 100)) : 0;

  const qaPairs = [
    {
      q: '¿Cómo mejoro mi velocidad de lectura?',
      a: 'La clave es la consistencia. Intenta leer 15 minutos diarios a la misma hora. También puedes activar el modo de lectura por voz (audiolibro) en la aplicación a velocidad 1.25x y seguir el texto visualmente con el ojo; esto entrena a tu cerebro a procesar palabras más rápido.',
    },
    {
      q: '¿Cómo funciona el modo audiolibro (TTS)?',
      a: 'Nuestra aplicación lee el texto en voz alta usando el sintetizador de voz nativo de Android. En el Lector, toca el ícono de volumen/bocina en el encabezado. Puedes ajustar la velocidad en el menú adyacente (por ejemplo, 1.25x o 1.5x) para adaptarlo a tu ritmo.',
    },
    {
      q: '¿Cómo activo el visor nativo PDF en mi celular?',
      a: 'Por seguridad, el visor de PDF requiere librerías nativas completas. Si estás probando la app en "Expo Go", verás un lector simulado con texto. Para usar el PDF real, abre tu terminal y compila el APK nativo ejecutando "npx expo run:android" con tu celular conectado.',
    },
  ];

  const handleAskQuestion = (question: string, answer: string) => {
    setIsAiLoading(true);
    setActiveQuestion(question);
    setAssistantResponse(null);

    setTimeout(() => {
      setAssistantResponse(answer);
      setIsAiLoading(false);
    }, 800);
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.container}>
        
        {/* TITLE BAR */}
        <View style={styles.titleBar}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Estadísticas e IA
          </ThemedText>
          <ThemedText type="code" style={styles.sectionSubtitle}>
            Monitorea tus metas y resuelve dudas con nuestro asistente
          </ThemedText>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.statsWrapper}>
            
            {/* GRID METRICS */}
             {/* GRID METRICS */}
             <View style={styles.statsRowsContainer}>
               <View style={styles.statsRow}>
                 {/* TIME CARD */}
                 <ThemedView type="backgroundElement" style={styles.gridCard}>
                   <Clock color="#4F46E5" size={24} />
                   <ThemedText type="title" style={styles.cardVal}>
                     {totalReadingMinutes}
                   </ThemedText>
                   <ThemedText type="code" style={styles.cardLbl}>
                     Minutos Leídos
                   </ThemedText>
                 </ThemedView>

                 {/* STREAK CARD */}
                 <ThemedView type="backgroundElement" style={styles.gridCard}>
                   <Flame color="#F59E0B" size={24} />
                   <ThemedText type="title" style={[styles.cardVal, { color: '#F59E0B' }]}>
                     {streakData?.streakCount || 0}
                   </ThemedText>
                   <ThemedText type="code" style={styles.cardLbl}>
                     Días de Racha
                   </ThemedText>
                 </ThemedView>
               </View>

               <View style={styles.statsRow}>
                  {/* COMPLETED CARD */}
                  <ThemedView type="backgroundElement" style={styles.gridCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <BookOpenCheck color="#10B981" size={24} />
                      <TouchableOpacity 
                        style={[styles.viewBtn, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]} 
                        onPress={() => setCompletedModalVisible(true)}>
                        <ThemedText type="code" style={styles.viewBtnText}>Ver</ThemedText>
                      </TouchableOpacity>
                    </View>
                    <ThemedText type="title" style={[styles.cardVal, { color: '#10B981', marginTop: 8 }]}>
                      {finishedBooks}
                    </ThemedText>
                    <ThemedText type="code" style={styles.cardLbl}>
                      Libros Leídos
                    </ThemedText>
                  </ThemedView>

                 {/* IN PROGRESS CARD */}
                 <ThemedView type="backgroundElement" style={styles.gridCard}>
                   <BookOpen color="#0EA5E9" size={24} />
                   <ThemedText type="title" style={[styles.cardVal, { color: '#0EA5E9' }]}>
                     {inProgressBooks}
                   </ThemedText>
                   <ThemedText type="code" style={styles.cardLbl}>
                     En Lectura
                   </ThemedText>
                 </ThemedView>
               </View>
             </View>

            {/* DAILY GOAL PROGRESS RING */}
            <ThemedView type="backgroundElement" style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Award color="#4F46E5" size={20} />
                <ThemedText type="smallBold" style={styles.goalTitle}>
                  Meta diaria de lectura
                </ThemedText>
                <ThemedText type="code" style={styles.goalPercent}>
                  {dailyProgressPercent}%
                </ThemedText>
              </View>

              <ThemedText type="code" style={styles.goalSubtitle}>
                {currentDailyMinutes} minutos de {dailyGoalMinutes} propuestos hoy
              </ThemedText>

              {/* Progress Bar */}
              <View style={[styles.goalProgressBg, { backgroundColor: activeColors.backgroundSelected }]}>
                <View
                  style={[
                    styles.goalProgressFill,
                    {
                      width: `${dailyProgressPercent}%`,
                      backgroundColor: dailyProgressPercent >= 100 ? '#10B981' : '#4F46E5',
                    },
                  ]}
                />
              </View>
            </ThemedView>

            {/* AI ASSISTANT SECTION */}
            <View style={styles.assistantContainer}>
              <View style={styles.assistantHeader}>
                <Sparkles color="#4F46E5" size={20} />
                <ThemedText type="smallBold" style={styles.assistantTitle}>
                  Asistente de Lectura Inteligente
                </ThemedText>
              </View>
              <ThemedText type="code" style={styles.assistantSubtitle}>
                Preguntas frecuentes y soporte técnico sobre lectura:
              </ThemedText>

              {/* Questions List */}
              <View style={styles.questionsList}>
                {qaPairs.map((pair, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleAskQuestion(pair.q, pair.a)}
                    style={[
                      styles.questionBtn,
                      {
                        backgroundColor: activeColors.backgroundElement,
                        borderColor: activeQuestion === pair.q ? '#4F46E5' : 'transparent',
                      },
                    ]}>
                    <HelpCircle color="#4F46E5" size={16} />
                    <ThemedText type="code" style={styles.questionText}>
                      {pair.q}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Assistant Response Box */}
              {activeQuestion && (
                <ThemedView type="backgroundElement" style={styles.responseBox}>
                  <ThemedText type="code" style={styles.responseQuestion}>
                    Pregunta: {activeQuestion}
                  </ThemedText>
                  {isAiLoading ? (
                    <ActivityIndicator size="small" color="#4F46E5" style={{ marginTop: 10 }} />
                  ) : (
                    <ThemedText type="default" style={styles.responseText}>
                      {assistantResponse}
                    </ThemedText>
                  )}
                </ThemedView>
              )}
            </View>
          </View>
        )}

        {/* COMPLETED BOOKS MODAL */}
        <Modal
          visible={completedModalVisible}
          animationType="slide"
          onRequestClose={() => setCompletedModalVisible(false)}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: activeColors.background }]}>
            <SafeAreaView style={styles.modalSafeArea}>
              
              {/* HEADER */}
              <View style={[styles.modalHeader, { borderBottomColor: activeColors.backgroundSelected }]}>
                <TouchableOpacity onPress={() => setCompletedModalVisible(false)} style={styles.modalBackBtn}>
                  <ArrowLeft color={activeColors.text} size={24} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.modalHeaderTitle}>
                  Libros Completados
                </ThemedText>
                <View style={{ width: 40 }} />
              </View>

              {/* LIST */}
              {completedBooks.length === 0 ? (
                <View style={styles.modalEmptyContainer}>
                  <BookOpenCheck color={activeColors.textSecondary} size={64} strokeWidth={1} />
                  <ThemedText type="default" style={styles.modalEmptyText}>
                    No has terminado ningún libro aún.
                  </ThemedText>
                  <ThemedText type="code" style={styles.modalEmptySubText}>
                    ¡Sigue leyendo tus PDFs para completarlos y verlos aquí!
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={completedBooks}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.modalBookCard, { backgroundColor: activeColors.backgroundElement, borderColor: activeColors.backgroundSelected }]}
                      onPress={() => {
                        setSelectedBook(item);
                        setReaderVisible(true);
                      }}>
                      
                      {/* Cover */}
                      <View style={[styles.modalBookCover, { backgroundColor: item.coverColor || '#4F46E5' }]}>
                        {item.coverUrl ? (
                          <Image 
                            source={{ uri: item.coverUrl }} 
                            style={styles.modalBookCoverImage} 
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <ThemedText style={styles.modalCoverInitials}>{item.initials}</ThemedText>
                        )}
                        <View style={styles.modalCoverDecoration} />
                      </View>

                      {/* Details */}
                      <View style={styles.modalBookDetails}>
                        <ThemedText type="smallBold" style={[styles.modalBookTitle, { color: activeColors.text }]} numberOfLines={2}>
                          {item.title}
                        </ThemedText>
                        <ThemedText type="code" style={styles.modalBookAuthor} numberOfLines={1}>
                          {item.author || 'Autor Desconocido'}
                        </ThemedText>
                        
                        <View style={styles.modalCompletedBadge}>
                          <BookOpenCheck color="#10B981" size={14} />
                          <ThemedText type="code" style={styles.modalCompletedBadgeText}>Completado</ThemedText>
                        </View>
                      </View>

                      {/* Open indicator */}
                      <View style={styles.modalRightColumn}>
                        <BookOpen color="#4F46E5" size={20} />
                        <ThemedText type="code" style={styles.modalOpenLabel}>Leer</ThemedText>
                      </View>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.modalListContent}
                  showsVerticalScrollIndicator={false}
                />
              )}

            </SafeAreaView>
          </ThemedView>

          {/* READER MODAL INSIDE EXPLORE */}
          <ReaderModal
            visible={readerVisible}
            book={selectedBook}
            onClose={() => {
              setReaderVisible(false);
              setSelectedBook(null);
              fetchStats(false); // reload stats quietly when done reading
            }}
            onProgressUpdate={async (bookId, lastPage, totalPages) => {
              await updateBookProgress(bookId, lastPage, totalPages);
              setSelectedBook((prev) =>
                prev ? { ...prev, lastPage, totalPages, progress: totalPages > 1 ? (lastPage - 1) / (totalPages - 1) : 1 } : null
              );
              fetchStats(false);
            }}
          />
        </Modal>

      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    paddingBottom: 40,
  },
  titleBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6E6E73',
    marginTop: Spacing.half,
  },
  statsWrapper: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  statsRowsContainer: {
    gap: Spacing.three,
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    width: '100%',
  },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  cardVal: {
    fontSize: 28,
    fontWeight: '700',
    marginVertical: Spacing.one,
  },
  cardLbl: {
    fontSize: 10,
    color: '#8E8E93',
  },
  goalCard: {
    borderRadius: 16,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  goalTitle: {
    fontSize: 15,
    marginLeft: 6,
    flex: 1,
  },
  goalPercent: {
    color: '#4F46E5',
    fontWeight: '700',
    marginLeft: Spacing.two,
  },
  goalSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: Spacing.two,
  },
  goalProgressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  assistantContainer: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assistantTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  assistantSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
  },
  questionsList: {
    gap: Spacing.two,
  },
  questionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  questionText: {
    fontSize: 12,
    flex: 1,
  },
  responseBox: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCC',
    marginTop: Spacing.one,
  },
  responseQuestion: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '700',
    marginBottom: 6,
  },
  responseText: {
    fontSize: 14,
    lineHeight: 20,
  },
  viewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  modalContainer: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalListContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalBookCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  modalBookCover: {
    width: 50,
    height: 70,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  modalBookCoverImage: {
    width: 50,
    height: 70,
    borderRadius: 6,
  },
  modalCoverInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalCoverDecoration: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  modalBookDetails: {
    flex: 1,
    marginLeft: Spacing.three,
    justifyContent: 'center',
  },
  modalBookTitle: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  modalBookAuthor: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 6,
  },
  modalCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalCompletedBadgeText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700',
  },
  modalRightColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    gap: 2,
  },
  modalOpenLabel: {
    fontSize: 9,
    color: '#4F46E5',
    fontWeight: '700',
  },
  modalEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    marginTop: 80,
  },
  modalEmptyText: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  modalEmptySubText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: Spacing.one,
    lineHeight: 18,
  },
});

