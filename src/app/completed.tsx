import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, CheckCircle2, BookOpen } from 'lucide-react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ReaderModal from '@/components/reader-modal';
import { Book, loadBooks, updateBookProgress } from '../utils/pdf-handler';
import { Spacing, Colors } from '../constants/theme';

export default function CompletedBooksScreen() {
  const scheme = useColorScheme();
  const activeColors = Colors[scheme === 'unspecified' || !scheme ? 'light' : scheme];

  const [completedBooks, setCompletedBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readerVisible, setReaderVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchCompletedBooks();
    }, [])
  );

  const fetchCompletedBooks = async () => {
    setLoading(true);
    const allBooks = await loadBooks();
    // Filter only completed books (progress >= 1.0 or progress === 100%)
    const filtered = allBooks.filter((b) => b.progress >= 1.0);
    setCompletedBooks(filtered);
    setLoading(false);
  };

  const handleOpenBook = (book: Book) => {
    setSelectedBook(book);
    setReaderVisible(true);
  };

  const handleProgressUpdate = async (bookId: string, lastPage: number, totalPages: number) => {
    const progress = lastPage / totalPages;
    await updateBookProgress(bookId, lastPage, totalPages);
    fetchCompletedBooks();
  };

  const renderBookItem = ({ item }: { item: Book }) => {
    return (
      <TouchableOpacity 
        style={[styles.bookCard, { backgroundColor: activeColors.card, borderColor: activeColors.border }]}
        onPress={() => handleOpenBook(item)}>
        
        {/* Cover */}
        <View style={[styles.bookCover, { backgroundColor: item.coverColor || '#4F46E5' }]}>
          {item.coverUrl ? (
            <Image 
              source={{ uri: item.coverUrl }} 
              style={styles.bookCoverImage} 
              contentFit="cover"
              transition={200}
            />
          ) : (
            <ThemedText style={styles.coverInitials}>{item.initials}</ThemedText>
          )}
          <View style={styles.coverDecoration} />
        </View>

        {/* Details */}
        <View style={styles.bookDetails}>
          <ThemedText type="smallBold" style={[styles.bookTitle, { color: activeColors.text }]} numberOfLines={2}>
            {item.title}
          </ThemedText>
          <ThemedText type="code" style={styles.bookAuthor} numberOfLines={1}>
            {item.author || 'Autor Desconocido'}
          </ThemedText>
          
          <View style={styles.completedBadge}>
            <CheckCircle2 color="#10B981" size={14} />
            <ThemedText type="code" style={styles.completedBadgeText}>Completado</ThemedText>
          </View>
        </View>

        {/* Right Arrow/Open Button */}
        <View style={styles.rightColumn}>
          <BookOpen color="#4F46E5" size={20} />
          <ThemedText type="code" style={styles.openLabel}>Leer</ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* HEADER BAR */}
        <View style={[styles.header, { borderBottomColor: activeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={activeColors.text} size={24} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Libros Completados
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* CONTENT */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <ThemedText type="code" style={styles.loaderText}>
              Cargando libros completados...
            </ThemedText>
          </View>
        ) : completedBooks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <CheckCircle2 color={activeColors.textSecondary} size={64} strokeWidth={1} />
            <ThemedText type="default" style={styles.emptyText}>
              No has terminado ningún libro aún.
            </ThemedText>
            <ThemedText type="code" style={styles.emptySubText}>
              ¡Sigue leyendo tus PDFs propuestos para completarlos y verlos aquí!
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={completedBooks}
            keyExtractor={(item) => item.id}
            renderItem={renderBookItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* READER MODAL */}
        <ReaderModal
          visible={readerVisible}
          book={selectedBook}
          onClose={() => {
            setReaderVisible(false);
            setSelectedBook(null);
            fetchCompletedBooks();
          }}
          onProgressUpdate={handleProgressUpdate}
        />

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
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  listContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  bookCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    alignItems: 'center',
  },
  bookCover: {
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
  bookCoverImage: {
    width: 50,
    height: 70,
    borderRadius: 6,
  },
  coverInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  coverDecoration: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  bookDetails: {
    flex: 1,
    marginLeft: Spacing.three,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 6,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedBadgeText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700',
  },
  rightColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    gap: 2,
  },
  openLabel: {
    fontSize: 9,
    color: '#4F46E5',
    fontWeight: '700',
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
    fontWeight: '800',
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: Spacing.one,
    lineHeight: 18,
  },
});
