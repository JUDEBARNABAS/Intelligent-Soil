import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, auth, storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { Book, Plus, Trash2, X, Loader2, Save, FileText, Video, Music, Upload, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KnowledgeEntry {
  id: string;
  title: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  timestamp: any;
  uid: string;
}

interface KnowledgeBaseProps {
  onClose: () => void;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'knowledge_base'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KnowledgeEntry[];
      setEntries(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (!newContent.trim() && !selectedFile) return;

    setSaving(true);
    setUploadProgress(0);
    try {
      let fileData = {};
      
      if (selectedFile) {
        const fileRef = ref(storage, `knowledge/${Date.now()}_${selectedFile.name}`);
        // Using uploadBytesResumable for progress tracking
        const { uploadBytesResumable } = await import('firebase/storage');
        const uploadTask = uploadBytesResumable(fileRef, selectedFile);

        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            }, 
            (error) => reject(error), 
            () => resolve(null)
          );
        });

        const url = await getDownloadURL(fileRef);
        fileData = {
          fileUrl: url,
          fileName: selectedFile.name,
          fileType: selectedFile.type
        };
      }

      await addDoc(collection(db, 'knowledge_base'), {
        title: newTitle.trim(),
        content: newContent.trim(),
        ...fileData,
        timestamp: Date.now(),
        uid: auth.currentUser?.uid || 'anonymous'
      });

      setNewTitle('');
      setNewContent('');
      setSelectedFile(null);
      setUploadProgress(null);
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding knowledge:', error);
      alert('Failed to save knowledge entry. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleDelete = async (id: string, fileUrl?: string) => {
    if (window.confirm('Are you sure you want to delete this knowledge entry?')) {
      try {
        if (fileUrl) {
          const { deleteObject } = await import('firebase/storage');
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
        }
        await deleteDoc(doc(db, 'knowledge_base', id));
      } catch (error) {
        console.error('Error deleting knowledge:', error);
      }
    }
  };

  const getFileIcon = (type?: string) => {
    if (!type) return <FileText size={20} />;
    if (type.includes('pdf')) return <FileText size={20} className="text-red-500" />;
    if (type.includes('video')) return <Video size={20} className="text-blue-500" />;
    if (type.includes('audio')) return <Music size={20} className="text-purple-500" />;
    return <File size={20} className="text-gray-500" />;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <header className="bg-emerald-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Book size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Knowledge Base</h2>
              <p className="text-xs opacity-70">Expert Agricultural Documentation</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Expert Knowledge & Files</h3>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md"
            >
              {isAdding ? <X size={18} /> : <Plus size={18} />}
              <span>{isAdding ? 'Cancel' : 'Add Entry'}</span>
            </button>
          </div>

          <AnimatePresence>
            {isAdding && (
              <motion.form 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleAdd}
                className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-4 overflow-hidden"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Title / Topic</label>
                  <input 
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Sunflower Pest Management Guide"
                    className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Description / Summary</label>
                  <textarea 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Describe the knowledge or provide a summary of the attached file..."
                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Attach File (PDF, Video, Audio)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-white border-2 border-dashed border-emerald-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 transition-colors"
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,video/*,audio/*"
                    />
                    {selectedFile ? (
                      <div className="flex items-center space-x-2 text-emerald-600">
                        {getFileIcon(selectedFile.type)}
                        <span className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-1 text-gray-400">
                        <Upload size={24} />
                        <span className="text-xs">Click to upload PDF, Video, or Audio</span>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all flex flex-col items-center justify-center space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>{saving ? (uploadProgress !== null ? `Uploading ${Math.round(uploadProgress)}%` : 'Saving...') : 'Save Knowledge Entry'}</span>
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full max-w-[200px] h-1 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-white"
                      />
                    </div>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 text-emerald-600">
              <Loader2 className="animate-spin" size={48} />
              <span className="font-bold">Loading knowledge...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
                <Book size={40} />
              </div>
              <p className="text-gray-500 max-w-[250px] mx-auto">
                No custom knowledge entries yet. Upload expert documentation to enhance the AI Agronomist.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {entries.map(entry => (
                <div key={entry.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group relative">
                  <button 
                    onClick={() => handleDelete(entry.id, entry.fileUrl)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                  
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      {entry.fileUrl ? getFileIcon(entry.fileType) : <FileText size={20} className="text-gray-400" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1 pr-8">{entry.title}</h4>
                      {entry.content && (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3">{entry.content}</p>
                      )}
                      {entry.fileUrl && (
                        <a 
                          href={entry.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Upload size={12} className="rotate-180" />
                          <span>View Attachment: {entry.fileName}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
