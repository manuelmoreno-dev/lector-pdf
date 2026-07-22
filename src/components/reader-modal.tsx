import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Volume2,
  VolumeX,
  Sparkles,
  Palette,
  Type,
  FileText,
  HelpCircle,
  Maximize2,
  Minimize2,
  Sun,
  AlertCircle,
  Trash2,
  CaseSensitive,
} from 'lucide-react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Book, isExpoGo, getMockBookContent, addBookNote, deleteBookNote, BookNote, incrementReadingTime } from '../utils/pdf-handler';
import { Colors, Spacing } from '../constants/theme';

// Safely require react-native-pdf for dev builds only
let PdfComponent: any = null;
try {
  if (!isExpoGo()) {
    const pdfModule = require('react-native-pdf');
    PdfComponent = pdfModule.default || pdfModule;
  }
} catch (e) {
  console.warn('Native PDF module could not be loaded. Running in simulation mode.');
}

interface ReaderModalProps {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  onProgressUpdate: (bookId: string, lastPage: number, totalPages: number) => void;
  autoPlaySpeech?: boolean;
}

type ThemeType = 'light' | 'dark' | 'sepia';

export default function ReaderModal({
  visible,
  book,
  onClose,
  onProgressUpdate,
  autoPlaySpeech = false,
}: ReaderModalProps) {
  const systemScheme = useColorScheme();
  
  // Custom reading settings states
  const [theme, setTheme] = useState<ThemeType>('light');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(10);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [notesRefresh, setNotesRefresh] = useState(0);
  
  // Interactive Bottom Icons Bar states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textSize, setTextSize] = useState(16);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans-serif' | 'monospace' | 'sans-serif-light'>('serif');
  const [brightnessPercent, setBrightnessPercent] = useState(100);
  const [brightnessTrackWidth, setBrightnessTrackWidth] = useState(200);
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'notes' | 'ai' | 'brightness'>('none');
  const [aiAssistantText, setAiAssistantText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [trackWidth, setTrackWidth] = useState(200);
  const [showFullscreenTip, setShowFullscreenTip] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const ttsTextRef = useRef<string>('');
  const lastTapRef = useRef<number>(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      setIsFullscreen(prev => !prev);
    }
    lastTapRef.current = now;
  };

  // Sync state with theme colors when book changes
  useEffect(() => {
    if (book) {
      setCurrentPage(book.lastPage || 1);
      setTotalPages(book.totalPages || 10);
      setIsLoading(true);
      // Reset toolbar states
      setIsFullscreen(false);
      setActiveDrawer('none');
      setAiAssistantText('');
    }
    // Set initial theme based on system preference
    setTheme(systemScheme === 'dark' ? 'dark' : 'light');
    
    return () => {
      Speech.stop();
      setIsPlayingSpeech(false);
    };
  }, [book, systemScheme]);

  // Trigger speech autoPlay if requested from book menu
  useEffect(() => {
    if (visible && autoPlaySpeech && book) {
      const timer = setTimeout(() => {
        handleSpeak();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [visible, autoPlaySpeech, book]);

  // Show a brief tip when entering fullscreen
  useEffect(() => {
    if (isFullscreen) {
      setShowFullscreenTip(true);
      const timer = setTimeout(() => {
        setShowFullscreenTip(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowFullscreenTip(false);
    }
  }, [isFullscreen]);

  // Increment reading duration timer when visible
  useEffect(() => {
    let interval: any = null;
    if (visible && book) {
      interval = setInterval(async () => {
        const { data, goalAchieved } = await incrementReadingTime(5);
        if (goalAchieved) {
          Alert.alert(
            '¡Meta Diaria Completada! 🎉🏆',
            `¡Has leído por ${data.goalMinutes} minutos hoy! Tu racha actual es de ${data.streakCount} ${data.streakCount === 1 ? 'día' : 'días'}.`
          );
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, book]);

  if (!book) return null;

  // Determine current theme colors
  const themeColors = {
    light: {
      background: '#FFFFFF',
      text: '#1C1C1E',
      textSecondary: '#6E6E73',
      border: '#E5E5EA',
      card: '#F2F2F7',
    },
    sepia: {
      background: '#F4ECD8',
      text: '#5B4636',
      textSecondary: '#8D735E',
      border: '#E4D5B9',
      card: '#EFE6CF',
    },
    dark: {
      background: '#121212',
      text: '#E5E5EA',
      textSecondary: '#8E8E93',
      border: '#2C2C2E',
      card: '#1C1C1E',
    },
  }[theme];

  // Screen dimming brightness opacity based on slider percentage (0% to 85% dimming max)
  const brightnessOpacity = 0.85 * (1 - brightnessPercent / 100);

  // TTS Narrator
  const handleSpeak = async () => {
    if (isPlayingSpeech) {
      Speech.stop();
      setIsPlayingSpeech(false);
      return;
    }

    try {
      let pageText = '';
      if (isExpoGo() || !PdfComponent) {
        pageText = getMockBookContent(book.title, currentPage);
      } else {
        pageText = `Leyendo página ${currentPage} de ${book.title}.`;
      }

      // Strip simulation tags for speaking
      const textToSpeak = pageText.replace(/\[.*?\]/g, '').replace(/Para leer el archivo PDF real.*/g, '').trim();

      setIsPlayingSpeech(true);
      Speech.speak(textToSpeak, {
        language: 'es-MX',
        rate: speechRate,
        onDone: () => setIsPlayingSpeech(false),
        onStopped: () => setIsPlayingSpeech(false),
        onError: (err) => {
          console.error(err);
          setIsPlayingSpeech(false);
        },
      });
    } catch (e) {
      console.error(e);
      setIsPlayingSpeech(false);
    }
  };

  const handleSpeechRateChange = () => {
    const rates = [1.0, 1.5, 2.0];
    const nextIndex = (rates.indexOf(speechRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setSpeechRate(nextRate);

    if (isPlayingSpeech) {
      Speech.stop().then(() => {
        setIsPlayingSpeech(false);
        setTimeout(() => {
          setIsPlayingSpeech(true);
          handleSpeak();
        }, 150);
      });
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      onProgressUpdate(book.id, page, totalPages);
      
      // If speaking, stop and speak new page
      if (isPlayingSpeech) {
        Speech.stop().then(() => {
          setIsPlayingSpeech(false);
          setTimeout(() => handleSpeak(), 150);
        });
      }
    }
  };

  const handleScrubberPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const percentage = locationX / trackWidth;
    const targetPage = Math.max(1, Math.min(totalPages, Math.round(percentage * totalPages)));
    handlePageChange(targetPage);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    const updated = await addBookNote(book.id, currentPage, noteText.trim());
    if (updated) {
      book.notes = updated.notes;
      setNoteText('');
      setNotesRefresh(prev => prev + 1);
      Alert.alert('Nota Guardada', `Se añadió tu anotación para la página ${currentPage}`);
    }
  };

  const handleDeleteNote = async (noteDate: number) => {
    Alert.alert(
      'Eliminar Nota',
      '¿Estás seguro de que deseas eliminar esta anotación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteBookNote(book.id, noteDate);
            if (updated) {
              book.notes = updated.notes;
              setNotesRefresh(prev => prev + 1);
            }
          }
        }
      ]
    );
  };

  // Mock AI Assistant explaining selected concepts
  const handleAskAI = (action: string) => {
    setActiveDrawer('ai');
    if (action === 'resumir') {
      setIsAiLoading(true);
      setAiAssistantText('La IA está analizando la página...');
      setTimeout(() => {
        const response = `Resumen de la IA ✨ (Pág. ${currentPage}):\n\nEl texto principal de esta página aborda los fundamentos conceptuales de la obra. Destaca las ideas clave sobre el desarrollo humano, la resiliencia mental y cómo el entorno influye en el aprendizaje. Resalta que una lectura activa y reflexiva facilita la asimilación del conocimiento.`;
        setAiAssistantText(response);
        setIsAiLoading(false);
      }, 1200);
    } else {
      // For explaining, reset states to allow typing
      setAiAssistantText('');
      setSearchQuery('');
    }
  };

  const handleAISearch = () => {
    if (!searchQuery.trim()) return;
    setIsAiLoading(true);
    setAiAssistantText('La IA está analizando e investigando el concepto...');
    
    const query = searchQuery.trim();
    
    setTimeout(() => {
      let response = '';
      
      const localDictionary: { [key: string]: string } = {
        'resiliencia': 'La resiliencia es la capacidad de adaptarse y superar situaciones adversas, traumas, tragedias o estrés grave. Implica salir fortalecido y con mayores recursos de las dificultades de la vida.',
        'metacognicion': 'La metacognición es la conciencia y comprensión de los propios procesos de pensamiento. Involucra saber cómo aprendes, monitorear tu nivel de comprensión y elegir estrategias adecuadas para resolver problemas.',
        'paradigma': 'Un paradigma es un modelo, patrón o teoría que sirve de marco de referencia para entender la realidad. Define qué preguntas son válidas de hacer y cómo deben investigarse las respuestas en un área determinada.',
        'empatia': 'La empatía es la capacidad de ponerse en el lugar del otro, comprendiendo sus sentimientos, emociones y puntos de vista de forma sincera y racional.',
        'sinopsis': 'Una sinopsis es una recopilación de datos o resumen general que presenta una perspectiva breve, clara y estructurada de una obra intelectual, literaria o de cualquier tema científico.',
      };

      const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      let matchedDefinition = '';
      for (const key in localDictionary) {
        if (normalizedQuery.includes(key)) {
          matchedDefinition = localDictionary[key];
          break;
        }
      }

      if (matchedDefinition) {
        response = `Explicación de la IA ✨\n\nConcepto: "${query}"\n\n${matchedDefinition}`;
      } else {
        response = `Explicación de la IA ✨\n\nConcepto: "${query}"\n\nLa IA define este término como un concepto fundamental. Se refiere a un elemento, idea o categoría de análisis clave dentro de esta disciplina, que ayuda a estructurar los argumentos y facilita la asimilación de los contenidos del texto.`;
      }
      
      setAiAssistantText(response);
      setIsAiLoading(false);
    }, 1200);
  };

  // Toolbar Cycling triggers
  const cycleTheme = () => {
    const themes: ThemeType[] = ['light', 'sepia', 'dark'];
    const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const cycleTextSize = () => {
    const sizes = [14, 18, 22];
    const nextIndex = (sizes.indexOf(textSize) + 1) % sizes.length;
    setTextSize(sizes[nextIndex]);
  };

  const cycleFontFamily = () => {
    const fonts = ['serif', 'sans-serif', 'monospace', 'sans-serif-light'];
    const nextIndex = (fonts.indexOf(fontFamily) + 1) % fonts.length;
    setFontFamily(fonts[nextIndex] as any);
  };

  const getFontLabel = () => {
    switch (fontFamily) {
      case 'serif': return 'Serif';
      case 'sans-serif': return 'Sans';
      case 'monospace': return 'Mono';
      case 'sans-serif-light': return 'Fina';
      default: return 'Serif';
    }
  };

  const handleBrightnessSliderPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const percentage = Math.max(0, Math.min(1, locationX / brightnessTrackWidth));
    setBrightnessPercent(Math.round(percentage * 100));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        

        {/* FULLSCREEN ONBOARDING TIP */}
        {showFullscreenTip && (
          <View style={[styles.fullscreenTipContainer, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
            <ThemedText style={styles.fullscreenTipText}>
              Doble toque para salir de pantalla completa
            </ThemedText>
          </View>
        )}
        {/* HEADER (Hidden in Fullscreen) */}
        {!isFullscreen && (
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <X color={themeColors.text} size={24} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <ThemedText type="smallBold" style={{ color: themeColors.text, textAlign: 'center' }} numberOfLines={1}>
                {book.title}
              </ThemedText>
              <ThemedText type="code" style={{ color: themeColors.textSecondary, fontSize: 10 }}>
                Pág. {currentPage} de {totalPages}
              </ThemedText>
            </View>

            <View style={styles.headerControls} />
          </View>
        )}

        {/* MAIN READER AREA */}
        <TouchableWithoutFeedback onPress={handleDoubleTap}>
          <View style={styles.readerArea}>
            {isExpoGo() || !PdfComponent ? (
              /* EXPO GO FALLBACK SIMULATOR */
              <ScrollView contentContainerStyle={styles.fallbackScroll}>
                {!isFullscreen && (
                  <View style={[styles.infoBanner, { backgroundColor: '#4F46E515', borderColor: '#4F46E540' }]}>
                    <View style={styles.bannerHeader}>
                      <Sparkles color="#4F46E5" size={18} />
                      <ThemedText type="smallBold" style={{ color: '#4F46E5', marginLeft: 6 }}>
                        Modo Simulación de Expo Go
                      </ThemedText>
                    </View>
                    <ThemedText type="code" style={{ color: themeColors.textSecondary, fontSize: 11, marginTop: 4 }}>
                      Para renderizar el PDF real completo con zoom y gestos fluidos, compila la app ejecutando <ThemedText type="code" style={{ color: '#4F46E5', fontWeight: 'bold' }}>npx expo run:android</ThemedText> en tu terminal. En este modo puedes probar todas las demás funciones (audio, notas, temas e IA).
                    </ThemedText>
                  </View>
                )}

                <View style={[styles.bookSheet, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <ThemedText style={{ color: themeColors.text, fontSize: textSize, lineHeight: textSize + 10, fontFamily: Platform.select({ web: fontFamily === 'serif' ? 'Georgia' : fontFamily === 'monospace' ? 'Courier' : 'Arial', default: fontFamily }) }}>
                    {getMockBookContent(book.title, currentPage)}
                  </ThemedText>
                </View>
              </ScrollView>
            ) : (
              /* NATIVE PDF COMPONENT */
              <View style={styles.pdfContainer}>
                <PdfComponent
                  source={{ uri: book.localUri }}
                  page={currentPage}
                  onPageChanged={(page: number, total: number) => {
                    setCurrentPage(page);
                    setTotalPages(total);
                    onProgressUpdate(book.id, page, total);
                  }}
                  onError={(error: any) => {
                    console.error('Pdf rendering error:', error);
                  }}
                  onLoadComplete={(total: number) => {
                    setTotalPages(total);
                    setIsLoading(false);
                  }}
                  style={[styles.pdf, { backgroundColor: themeColors.background }]}
                />
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* ACTIVE DRAWER (AI OR NOTES) (Hidden in Fullscreen) */}
        {!isFullscreen && activeDrawer !== 'none' && (
          <View style={[styles.drawer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
            
            {/* CLOSE DRAWER BAR */}
            <View style={styles.drawerHeader}>
              <ThemedText type="smallBold" style={{ color: themeColors.text }}>
                {activeDrawer === 'notes' ? 'Anotaciones y Notas 📝' : 'Asistente IA ✨'}
              </ThemedText>
              <TouchableOpacity onPress={() => setActiveDrawer('none')}>
                <X color={themeColors.textSecondary} size={18} />
              </TouchableOpacity>
            </View>

            {/* AI DRAWER */}
            {activeDrawer === 'ai' && (
              <View style={styles.aiContentBox}>
                {/* Search Bar for Explain Word */}
                <View style={styles.aiSearchRow}>
                  <TextInput
                    placeholder="¿Qué palabra o concepto no entiendes?"
                    placeholderTextColor={themeColors.textSecondary}
                    style={[styles.aiInput, { color: themeColors.text, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleAISearch}
                  />
                  <TouchableOpacity onPress={handleAISearch} style={styles.aiSearchBtn}>
                    <Sparkles color="#FFFFFF" size={16} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.aiResultScroll} showsVerticalScrollIndicator={false}>
                  {isAiLoading ? (
                    <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#4F46E5" />
                      <ThemedText type="code" style={{ fontSize: 11, color: themeColors.textSecondary, marginTop: 6 }}>
                        La IA está investigando...
                      </ThemedText>
                    </View>
                  ) : aiAssistantText ? (
                    <ThemedText type="code" style={{ color: themeColors.text, fontSize: 13, lineHeight: 19 }}>
                      {aiAssistantText}
                    </ThemedText>
                  ) : (
                    <ThemedText type="code" style={{ color: themeColors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 15 }}>
                      Escribe la palabra que no entiendas arriba y presiona el botón de chispas para buscarla con IA.
                    </ThemedText>
                  )}
                </ScrollView>
              </View>
            )}

            {/* NOTES DRAWER */}
            {activeDrawer === 'notes' && (
              <View style={styles.notesContentBox}>
                <View style={styles.noteInputRow}>
                  <TextInput
                    placeholder="Escribe una anotación para esta página..."
                    placeholderTextColor={themeColors.textSecondary}
                    style={[styles.noteInput, { color: themeColors.text, backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    value={noteText}
                    onChangeText={setNoteText}
                  />
                  <TouchableOpacity onPress={handleSaveNote} style={styles.saveNoteBtn}>
                    <Bookmark color="#FFFFFF" size={18} />
                  </TouchableOpacity>
                </View>

                {/* Display Saved Notes */}
                <ScrollView style={styles.savedNotesScroll} showsVerticalScrollIndicator={false}>
                  {book.notes && book.notes.filter(n => n.page === currentPage).length > 0 ? (
                    book.notes.filter(n => n.page === currentPage).map((n, i) => (
                      <View key={i} style={[styles.noteItem, { backgroundColor: themeColors.background, borderColor: themeColors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                        <ThemedText type="code" style={{ color: themeColors.text, fontSize: 12, flex: 1, paddingRight: 8 }}>
                          • {n.text}
                        </ThemedText>
                        <TouchableOpacity onPress={() => handleDeleteNote(n.date)} style={{ padding: 4 }}>
                          <Trash2 color="#EF4444" size={14} />
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <ThemedText type="code" style={{ color: themeColors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
                      No hay notas guardadas en esta página.
                    </ThemedText>
                  )}
                </ScrollView>
              </View>
            )}

          </View>
        )}

        {/* BOTTOM PAGINATION PANEL (Hidden in Fullscreen) */}
        {!isFullscreen && (
          <View style={[styles.paginationContainer, { borderTopColor: themeColors.border }]}>
            {/* Page Back */}
            <TouchableOpacity 
              onPress={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage <= 1} 
              style={[styles.modernNavBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <ChevronLeft color={currentPage <= 1 ? themeColors.textSecondary : themeColors.text} size={20} />
            </TouchableOpacity>

            {/* Scrubber timeline */}
            <View style={styles.scrubberContainer}>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleScrubberPress}
                style={[styles.scrubberTrack, { backgroundColor: themeColors.border }]}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
                <View 
                  style={[
                    styles.scrubberProgress, 
                    { 
                      width: `${(currentPage / totalPages) * 100}%`,
                      backgroundColor: '#4F46E5' 
                    }
                  ]} 
                />
                <View 
                  style={[
                    styles.scrubberThumb, 
                    { 
                      left: `${((currentPage - 1) / (totalPages - 1 || 1)) * 100}%`,
                      backgroundColor: '#FFFFFF',
                      borderColor: '#4F46E5'
                    }
                  ]} 
                />
              </TouchableOpacity>
              <ThemedText type="code" style={[styles.scrubberText, { color: themeColors.textSecondary }]}>
                Pág. {currentPage} de {totalPages} ({Math.round((currentPage / totalPages) * 100)}%)
              </ThemedText>
            </View>

            {/* Page Forward */}
            <TouchableOpacity 
              onPress={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage >= totalPages} 
              style={[styles.modernNavBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <ChevronRight color={currentPage >= totalPages ? themeColors.textSecondary : themeColors.text} size={20} />
            </TouchableOpacity>
          </View>
        )}

        {/* BOTTOM ICONS UTILITY TOOLBAR (Hidden in Fullscreen) */}
        {!isFullscreen && (
          <View style={[styles.bottomIconBar, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
            
            {/* 1. PALETTE (Themes) */}
            <TouchableOpacity style={styles.toolbarButton} onPress={cycleTheme}>
              <Palette color={themeColors.text} size={20} />
              <ThemedText type="code" style={styles.toolbarLabel}>Tono</ThemedText>
            </TouchableOpacity>

            {/* 2. TEXT SIZE (AA) */}
            <TouchableOpacity style={styles.toolbarButton} onPress={cycleTextSize}>
              <Type color={themeColors.text} size={20} />
              <ThemedText type="code" style={styles.toolbarLabel}>{textSize}px</ThemedText>
            </TouchableOpacity>

            {/* Tipografía */}
            <TouchableOpacity style={styles.toolbarButton} onPress={cycleFontFamily}>
              <CaseSensitive color={themeColors.text} size={20} />
              <ThemedText type="code" style={styles.toolbarLabel}>{getFontLabel()}</ThemedText>
            </TouchableOpacity>

            {/* 3. NOTES */}
            <TouchableOpacity 
              style={[styles.toolbarButton, activeDrawer === 'notes' && styles.activeToolbarBtn]} 
              onPress={() => setActiveDrawer(activeDrawer === 'notes' ? 'none' : 'notes')}>
              <FileText color={activeDrawer === 'notes' ? '#4F46E5' : themeColors.text} size={20} />
              <ThemedText type="code" style={[styles.toolbarLabel, activeDrawer === 'notes' && { color: '#4F46E5' }]}>Notas</ThemedText>
            </TouchableOpacity>

            {/* 4. EXPLAIN CONCEPT (AI) */}
            <TouchableOpacity style={styles.toolbarButton} onPress={() => handleAskAI('explicar')}>
              <HelpCircle color={themeColors.text} size={20} />
              <ThemedText type="code" style={styles.toolbarLabel}>Explicar</ThemedText>
            </TouchableOpacity>

            {/* 5. SUMMARIZE PAGE (AI) */}
            <TouchableOpacity style={styles.toolbarButton} onPress={() => handleAskAI('resumir')}>
              <Sparkles color={themeColors.text} size={20} />
              <ThemedText type="code" style={styles.toolbarLabel}>Resumen</ThemedText>
            </TouchableOpacity>

            {/* 8. FULLSCREEN MODE */}
            <TouchableOpacity style={styles.toolbarButton} onPress={() => setIsFullscreen(true)}>
              <Maximize2 color={themeColors.text} size={20} />
              <ThemedText type="code" style={styles.toolbarLabel}>Pantalla</ThemedText>
            </TouchableOpacity>

          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  rateButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readerArea: {
    flex: 1,
  },
  fallbackScroll: {
    padding: Spacing.three,
  },
  infoBanner: {
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookSheet: {
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 400,
  },
  pdfContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  drawer: {
    padding: Spacing.three,
    borderTopWidth: 1,
    maxHeight: 220,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  aiContentBox: {
    padding: Spacing.two,
  },
  aiSearchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  aiInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
  },
  aiSearchBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiResultScroll: {
    maxHeight: 120,
  },
  brightnessContentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    gap: Spacing.three,
  },
  brightnessTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    position: 'relative',
  },
  brightnessProgress: {
    height: '100%',
    borderRadius: 3,
  },
  brightnessThumb: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    marginLeft: -7,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  notesContentBox: {
    gap: Spacing.two,
  },
  noteInputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  noteInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
  },
  saveNoteBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedNotesScroll: {
    maxHeight: 100,
    marginTop: 4,
  },
  noteItem: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  paginationContainer: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    borderTopWidth: 1,
  },
  modernNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
  },
  scrubberContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scrubberTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  scrubberProgress: {
    height: '100%',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
    marginLeft: -6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  scrubberText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomIconBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
  },
  toolbarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 2,
  },
  toolbarLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
  },
  activeToolbarBtn: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  fullscreenTipContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10000,
  },
  fullscreenTipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
