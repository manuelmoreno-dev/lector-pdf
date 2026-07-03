import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

export interface BookNote {
  page: number;
  text: string;
  date: number;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  coverUrl?: string;
  synopsis?: string;
  workKey?: string;
  localUri: string;
  addedAt: number;
  progress: number; // 0 to 1
  lastPage: number;
  totalPages: number;
  lastReadAt: number;
  coverColor: string;
  initials: string;
  notes?: BookNote[];
}

const STORAGE_KEY = '@pdf_reader_books';

// Helper to check if running in Expo Go
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

// Generate random pastel color gradients for book covers
export function generateCoverColor(title: string): string {
  const colors = [
    '#4F46E5', // Indigo
    '#0EA5E9', // Sky Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#14B8A6', // Teal
  ];
  const charSum = title.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
}

// Get initials of a book title (max 2 characters)
export function getInitials(title: string): string {
  const cleaned = title.replace(/[^a-zA-Z0-9 ]/g, '');
  const words = cleaned.split(' ').filter(w => w.length > 0);
  if (words.length === 0) return 'BK';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Save list of books to AsyncStorage
export async function saveBooks(books: Book[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (error) {
    console.error('Error saving books:', error);
  }
}

// Load list of books from AsyncStorage
export async function loadBooks(): Promise<Book[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error loading books:', error);
    return [];
  }
}

function decodeHexPDFString(hex: string): string {
  try {
    if (hex.toLowerCase().startsWith('feff')) {
      let str = '';
      for (let i = 4; i < hex.length; i += 4) {
        const charCode = parseInt(hex.substring(i, i + 4), 16);
        if (!isNaN(charCode)) str += String.fromCharCode(charCode);
      }
      return str.trim();
    }
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substring(i, i + 2), 16);
      if (!isNaN(charCode)) str += String.fromCharCode(charCode);
    }
    return str.trim();
  } catch {
    return '';
  }
}

function parsePDFField(content: string, fieldName: string): string | null {
  const parenRegex = new RegExp(`/${fieldName}\\s*\\(([^)]+)\\)`, 'i');
  const parenMatch = content.match(parenRegex);
  if (parenMatch && parenMatch[1]) {
    // Return value but clean up typical backslash escaped chars
    return parenMatch[1].replace(/\\([()])/g, '$1').trim();
  }

  const hexRegex = new RegExp(`/${fieldName}\\s*<([a-fA-F0-9]+)>`, 'i');
  const hexMatch = content.match(hexRegex);
  if (hexMatch && hexMatch[1]) {
    const decoded = decodeHexPDFString(hexMatch[1]);
    if (decoded) return decoded;
  }

  if (fieldName === 'Title') {
    const xmpTitleRegex = /<dc:title>[^<]*<rdf:Alt>[^<]*<rdf:li[^>]*>([^<]+)<\/rdf:li>/i;
    const xmpMatch = content.match(xmpTitleRegex);
    if (xmpMatch && xmpMatch[1]) return xmpMatch[1].trim();
  } else if (fieldName === 'Author') {
    const xmpAuthorRegex = /<dc:creator>[^<]*<rdf:Seq>[^<]*<rdf:li[^>]*>([^<]+)<\/rdf:li>/i;
    const xmpMatch = content.match(xmpAuthorRegex);
    if (xmpMatch && xmpMatch[1]) return xmpMatch[1].trim();
  }

  return null;
}

export async function extractPDFMetadata(uri: string): Promise<{ title: string | null; author: string | null }> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) return { title: null, author: null };
    
    const size = fileInfo.size || 0;
    let content = '';

    try {
      if (size < 250000) {
        content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      } else {
        const firstChunk = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
          length: 100000,
          position: 0
        });
        const lastChunk = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
          length: 100000,
          position: size - 100000
        });
        content = firstChunk + '\n' + lastChunk;
      }
    } catch {
      content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    }

    const title = parsePDFField(content, 'Title');
    const author = parsePDFField(content, 'Author');

    return { title, author };
  } catch (error) {
    console.error('Error parsing PDF metadata:', error);
    return { title: null, author: null };
  }
}

// Copy a document from document picker to the local app directory and register it
export async function importBook(uri: string, name: string): Promise<Book | null> {
  try {
    const fileExtension = name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'pdf') {
      throw new Error('Only PDF files are supported.');
    }

    const books = await loadBooks();
    const id = Date.now().toString();
    const cleanName = name.replace(/[\s\(\)]/g, '_');
    const destinationUri = `${FileSystem.documentDirectory}books/${id}_${cleanName}`;

    // Ensure books directory exists
    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}books/`);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}books/`, { intermediates: true });
    }

    // Copy file
    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri,
    });

    // Try to extract metadata (title/author) from the actual PDF file
    const pdfMeta = await extractPDFMetadata(destinationUri);
    const finalTitle = pdfMeta.title || name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
    const finalAuthor = pdfMeta.author || 'Autor Desconocido';

    let coverUrl: string | undefined = undefined;
    let localCoverUri: string | undefined = undefined;

    // Search OpenLibrary for the extracted title to get the official cover
    try {
      const apiResult = await fetchBookMetadataFromAPI(finalTitle);
      if (apiResult && apiResult.coverUrl) {
        coverUrl = apiResult.coverUrl;
        
        // Download it locally for offline availability
        const coverFilename = `${id}_cover.jpg`;
        const coverDest = `${FileSystem.documentDirectory}books/${coverFilename}`;
        
        const downloadResult = await FileSystem.downloadAsync(coverUrl, coverDest);
        localCoverUri = downloadResult.uri;
      }
    } catch (e) {
      console.error('Error fetching/downloading cover during import:', e);
    }

    const newBook: Book = {
      id,
      title: finalTitle,
      author: finalAuthor,
      localUri: destinationUri,
      coverUrl: localCoverUri || coverUrl,
      addedAt: Date.now(),
      progress: 0,
      lastPage: 1,
      totalPages: 10, // Default page count, will update once opened
      lastReadAt: Date.now(),
      coverColor: generateCoverColor(finalTitle),
      initials: getInitials(finalTitle),
      notes: [],
    };

    const updatedBooks = [newBook, ...books];
    await saveBooks(updatedBooks);
    return newBook;
  } catch (error) {
    console.error('Error importing book:', error);
    return null;
  }
}

// Delete a book from local directory and library list
export async function deleteBook(id: string, localUri: string): Promise<boolean> {
  try {
    const books = await loadBooks();
    const updatedBooks = books.filter(b => b.id !== id);

    // Delete physical file
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }

    await saveBooks(updatedBooks);
    return true;
  } catch (error) {
    console.error('Error deleting book:', error);
    return false;
  }
}

// Update reading progress of a book
export async function updateBookProgress(id: string, lastPage: number, totalPages: number): Promise<Book[]> {
  const books = await loadBooks();
  const updated = books.map(book => {
    if (book.id === id) {
      const safeTotal = totalPages > 0 ? totalPages : book.totalPages;
      const progress = safeTotal > 1 ? (lastPage - 1) / (safeTotal - 1) : 1;
      return {
        ...book,
        lastPage,
        totalPages: safeTotal,
        progress: Math.min(Math.max(progress, 0), 1),
        lastReadAt: Date.now(),
      };
    }
    return book;
  });
  await saveBooks(updated);
  return updated;
}

// Add note to a book
export async function addBookNote(id: string, page: number, text: string): Promise<Book | null> {
  const books = await loadBooks();
  let updatedBook: Book | null = null;

  const updated = books.map(book => {
    if (book.id === id) {
      const currentNotes = book.notes || [];
      const newNote: BookNote = { page, text, date: Date.now() };
      updatedBook = {
        ...book,
        notes: [newNote, ...currentNotes],
      };
      return updatedBook;
    }
    return book;
  });

  await saveBooks(updated);
  return updatedBook;
}

// Delete note from a book
export async function deleteBookNote(id: string, noteDate: number): Promise<Book | null> {
  const books = await loadBooks();
  let updatedBook: Book | null = null;

  const updated = books.map(book => {
    if (book.id === id) {
      const filteredNotes = book.notes ? book.notes.filter(note => note.date !== noteDate) : [];
      updatedBook = {
        ...book,
        notes: filteredNotes,
      };
      return updatedBook;
    }
    return book;
  });

  await saveBooks(updated);
  return updatedBook;
}

// MOCK READING DATA FOR EXPO GO SIMULATION
// Provides realistic content to read and speak via TTS
export function getMockBookContent(title: string, page: number): string {
  const mockChapters = [
    {
      chapter: 'Capítulo 1: La Iniciación',
      text: [
        'En los confines de un nuevo comienzo, el lector abre las páginas de una gran aventura. Leer no es solo descifrar palabras, sino viajar en el tiempo, adentrarse en mentes ajenas y descubrir nuevos horizontes sin mover un solo paso.',
        'Este es el modo simulación de nuestra aplicación. Aquí puedes probar el Text-To-Speech (lectura por voz), cambiar los temas visuales (Claro, Oscuro y Sepia) y ajustar el progreso de tu lectura.',
        'Para leer el archivo PDF real completo, con zoom fluido y renderizado de alta resolución, deberás compilar esta aplicación ejecutando el comando de compilación nativa en tu terminal.',
      ],
    },
    {
      chapter: 'Capítulo 2: El Poder de la Voz',
      text: [
        'El sonido de las palabras habladas tiene una magia única. Al integrar el motor de Text-To-Speech de Expo, tu teléfono se convierte en un compañero que te lee mientras viajas, cocinas o descansas.',
        'La accesibilidad es clave en el desarrollo moderno. La posibilidad de transformar cualquier texto digital en sonido amplía las oportunidades para personas con discapacidades visuales o para quienes prefieren el aprendizaje auditivo.',
        'Puedes cambiar la velocidad de la lectura utilizando los controles en el encabezado. Prueba con velocidad 1.5x o 2.0x si deseas consumir el contenido más rápido.',
      ],
    },
    {
      chapter: 'Capítulo 3: Hacia la Compilación Nativa',
      text: [
        'Para compilar un cliente de desarrollo en Android, debes asegurarte de tener configurado Android Studio y el SDK. Ejecutar `npx expo run:android` compilará las librerías nativas como react-native-pdf.',
        'Las aplicaciones híbridas hechas con React Native ofrecen un excelente rendimiento porque combinan la flexibilidad de escribir código en TypeScript con componentes de interfaz de usuario verdaderamente nativos.',
        'Esperamos que disfrutes de esta experiencia de lectura mejorada. Tu estantería de libros está lista para organizar todo tu conocimiento digital.',
      ],
    },
  ];

  const totalPages = 15;
  const chapterIndex = Math.min(Math.floor((page - 1) / 5), mockChapters.length - 1);
  const chapter = mockChapters[chapterIndex];
  const paragraphIndex = (page - 1) % 5;
  const paragraph = chapter.text[paragraphIndex % chapter.text.length] || chapter.text[0];

  return `[${title}]\n\n${chapter.chapter}\n\nPágina ${page} de ${totalPages}\n\n${paragraph}`;
}

export function cleanBookMetadataWithAI(title: string): { title: string; author: string } {
  let cleaned = title.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
  
  const popularBooks = [
    { keywords: ['clean', 'code', 'martin'], title: 'Clean Code', author: 'Robert C. Martin' },
    { keywords: ['cien', 'anos', 'soledad', 'marquez'], title: 'Cien Años de Soledad', author: 'Gabriel García Márquez' },
    { keywords: ['quijote', 'cervantes'], title: 'Don Quijote de la Mancha', author: 'Miguel de Cervantes' },
    { keywords: ['principito', 'exupery'], title: 'El Principito', author: 'Antoine de Saint-Exupéry' },
    { keywords: ['padre', 'rico', 'kiyosaki'], title: 'Padre Rico, Padre Pobre', author: 'Robert Kiyosaki' },
    { keywords: ['habitos', 'atomicos', 'clear'], title: 'Hábitos Atómicos', author: 'James Clear' },
    { keywords: ['harry', 'potter', 'rowling'], title: 'Harry Potter', author: 'J.K. Rowling' },
    { keywords: ['1984', 'orwell'], title: '1984', author: 'George Orwell' },
  ];

  const lowerCleaned = cleaned.toLowerCase();
  
  for (const book of popularBooks) {
    if (book.keywords.every(kw => lowerCleaned.includes(kw))) {
      return { title: book.title, author: book.author };
    }
  }

  let guessedTitle = cleaned;
  let guessedAuthor = 'Autor Desconocido';

  if (cleaned.includes(' por ')) {
    const parts = cleaned.split(' por ');
    guessedTitle = parts[0].trim();
    guessedAuthor = parts[1].trim();
  } else if (cleaned.includes(' by ')) {
    const parts = cleaned.split(' by ');
    guessedTitle = parts[0].trim();
    guessedAuthor = parts[1].trim();
  } else if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    if (parts.length >= 2) {
      guessedTitle = parts[1].trim();
      guessedAuthor = parts[0].trim();
    }
  }

  // Capitalize nicely
  guessedTitle = guessedTitle.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  if (guessedAuthor !== 'Autor Desconocido') {
    guessedAuthor = guessedAuthor.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  return { title: guessedTitle, author: guessedAuthor };
}

export async function fetchBookMetadataFromAPI(title: string): Promise<{ title: string; author: string; coverUrl?: string; workKey?: string }> {
  let cleaned = title.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
  
  try {
    const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(cleaned)}&limit=1`);
    const data = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      const doc = data.docs[0];
      const bookTitle = doc.title;
      const bookAuthor = doc.author_name ? doc.author_name[0] : 'Autor Desconocido';
      const coverUrl = doc.cover_i 
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` 
        : undefined;
      const workKey = doc.key;
        
      return {
        title: bookTitle,
        author: bookAuthor,
        coverUrl,
        workKey,
      };
    }
  } catch (error) {
    console.error('Error fetching book metadata from API:', error);
  }

  const corrected = cleanBookMetadataWithAI(title);
  return {
    title: corrected.title,
    author: corrected.author,
  };
}

export async function autoCorrectBookMetadata(id: string): Promise<Book[]> {
  const books = await loadBooks();
  
  const bookToCorrect = books.find(b => b.id === id);
  if (!bookToCorrect) return books;
  
  const corrected = await fetchBookMetadataFromAPI(bookToCorrect.title);
  
  const updated = books.map(book => {
    if (book.id === id) {
      return {
        ...book,
        title: corrected.title,
        author: corrected.author,
        coverUrl: corrected.coverUrl,
        workKey: corrected.workKey,
        initials: getInitials(corrected.title),
      };
    }
    return book;
  });
  
  await saveBooks(updated);
  return updated;
}

export async function updateBookMetadata(
  id: string,
  metadata: { title: string; author: string; coverUrl?: string; workKey?: string }
): Promise<Book[]> {
  const books = await loadBooks();
  const updated = books.map(book => {
    if (book.id === id) {
      return {
        ...book,
        title: metadata.title,
        author: metadata.author,
        coverUrl: metadata.coverUrl,
        workKey: metadata.workKey,
        initials: getInitials(metadata.title),
      };
    }
    return book;
  });
  await saveBooks(updated);
  return updated;
}

export function generateLocalSynopsis(title: string, author?: string): string {
  const authorText = author && author !== 'Autor Desconocido' ? ` de ${author}` : '';
  
  const popularSummaries: { [key: string]: string } = {
    'clean code': 'Clean Code es un libro clásico para desarrolladores que enseña cómo escribir código limpio, legible y fácil de mantener. Explica los principios de refactorización, nomenclatura, diseño de clases y pruebas unitarias con ejemplos prácticos en Java.',
    'cien años de soledad': 'Cien Años de Soledad narra la historia de siete generaciones de la familia Buendía en el pueblo ficticio de Macondo, explorando temas como la soledad, el destino, la guerra civil, el incesto y el realismo mágico que caracterizan la obra de Gabriel García Márquez.',
    'el principito': 'El Principito cuenta la historia de un joven príncipe que viaja por el universo visitando planetas, aprendiendo sobre el amor, la amistad y las verdaderas prioridades de la vida humana a través de metáforas poéticas sencillas.',
  };

  const lowerTitle = title.toLowerCase();
  for (const key in popularSummaries) {
    if (lowerTitle.includes(key)) {
      return popularSummaries[key];
    }
  }

  return `"${title}"${authorText} es una obra literaria destacada. Este texto explora las ideas de la materia, proponiendo guías conceptuales y enfoques prácticos que permiten comprender e internalizar los fundamentos de su campo. Un material ideal para expandir conocimientos académicos o profesionales en la disciplina.`;
}

function isEnglishText(text: string): boolean {
  const englishWords = [' the ', ' of ', ' and ', ' to ', ' was ', ' with ', ' is ', ' that ', ' his ', ' her '];
  const lower = text.toLowerCase();
  return englishWords.some(word => lower.includes(word));
}

async function translateToSpanish(text: string): Promise<string> {
  if (!text) return '';
  try {
    const textToTranslate = text.substring(0, 600);
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=en|es`);
    const data = await response.json();
    if (data.responseData && data.responseData.translatedText) {
      let result = data.responseData.translatedText;
      if (text.length > 600) {
        result += '...';
      }
      return result;
    }
  } catch (error) {
    console.error('Error translating text:', error);
  }
  return text;
}

export async function fetchSynopsisFromAPI(title: string, workKey?: string): Promise<string> {
  try {
    let key = workKey;
    if (!key) {
      let cleaned = title.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
      const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(cleaned)}&limit=1`);
      const data = await response.json();
      if (data.docs && data.docs.length > 0) {
        key = data.docs[0].key;
      }
    }
    
    if (key) {
      const response = await fetch(`https://openlibrary.org${key}.json`);
      const data = await response.json();
      let rawDescription = '';
      
      if (data.description) {
        if (typeof data.description === 'string') {
          rawDescription = data.description;
        } else if (data.description.value) {
          rawDescription = data.description.value;
        }
      }
      
      if (rawDescription) {
        if (isEnglishText(rawDescription)) {
          return await translateToSpanish(rawDescription);
        }
        return rawDescription;
      }
    }
  } catch (error) {
    console.error('Error fetching synopsis:', error);
  }
  return '';
}

export async function saveBookSynopsis(id: string, synopsis: string): Promise<Book[]> {
  const books = await loadBooks();
  const updated = books.map(book => {
    if (book.id === id) {
      return { ...book, synopsis };
    }
    return book;
  });
  await saveBooks(updated);
  return updated;
}

export interface ReadingStreakData {
  streakCount: number;
  lastReadDate: string; // YYYY-MM-DD
  goalMinutes: number;
  goalCompletedToday: boolean;
  todaySecondsRead: number;
  todayDate: string; // YYYY-MM-DD
}

const STREAK_KEY = '@pdf_reader_streak_data';

export async function getStreakData(): Promise<ReadingStreakData> {
  const currentLocalDate = new Date().toISOString().split('T')[0];
  try {
    const dataStr = await AsyncStorage.getItem(STREAK_KEY);
    if (!dataStr) {
      const defaultData: ReadingStreakData = {
        streakCount: 0,
        lastReadDate: '',
        goalMinutes: 0,
        goalCompletedToday: false,
        todaySecondsRead: 0,
        todayDate: currentLocalDate,
      };
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(defaultData));
      return defaultData;
    }

    const data: ReadingStreakData = JSON.parse(dataStr);
    
    if (data.todayDate !== currentLocalDate) {
      data.todaySecondsRead = 0;
      data.goalCompletedToday = false;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (data.lastReadDate !== yesterdayStr && data.lastReadDate !== currentLocalDate && data.lastReadDate !== '') {
        data.streakCount = 0;
      }
      
      data.goalMinutes = 0;
      data.todayDate = currentLocalDate;
      
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    console.error('Error loading streak data:', error);
    return {
      streakCount: 0,
      lastReadDate: '',
      goalMinutes: 0,
      goalCompletedToday: false,
      todaySecondsRead: 0,
      todayDate: currentLocalDate,
    };
  }
}

export async function saveStreakData(data: ReadingStreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving streak data:', error);
  }
}

export async function setDailyGoal(minutes: number): Promise<ReadingStreakData> {
  const data = await getStreakData();
  data.goalMinutes = minutes;
  data.todaySecondsRead = 0;
  data.goalCompletedToday = false;
  await saveStreakData(data);
  return data;
}

export async function incrementReadingTime(seconds: number): Promise<{ data: ReadingStreakData; goalAchieved: boolean }> {
  const data = await getStreakData();
  
  if (data.goalMinutes === 0) {
    data.goalMinutes = 15;
  }

  data.todaySecondsRead += seconds;
  
  let goalAchieved = false;
  const targetSeconds = data.goalMinutes * 60;
  
  if (data.todaySecondsRead >= targetSeconds && !data.goalCompletedToday) {
    data.goalCompletedToday = true;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const currentLocalDate = new Date().toISOString().split('T')[0];
    
    if (data.lastReadDate === yesterdayStr || data.streakCount === 0 || data.lastReadDate === '') {
      data.streakCount += 1;
    } else if (data.lastReadDate === currentLocalDate) {
      // Already read today
    } else {
      data.streakCount = 1;
    }
    
    data.lastReadDate = currentLocalDate;
    goalAchieved = true;
  }
  
  await saveStreakData(data);
  return { data, goalAchieved };
}
