
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/dbClient';
import { Product, ProductCategory } from '../types';
import { useAuth } from './AuthContext';

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (id: string, amount: number) => Promise<void>;
}

const ProductContext = createContext<ProductContextType>({} as ProductContextType);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const stringifyError = (err: any) => {
    if (!err) return 'Erro desconhecido';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    return JSON.stringify(err);
  };

  const fetchProducts = async () => {
    if (!user) {
        setProducts([]); 
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('client_id', user.id)
        .order('name');

      if (error) {
        console.error('Error fetching products:', stringifyError(error));
        setProducts([]);
      } else {
        setProducts(data ? data.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category || 'other',
            stock: p.stock || 0,
            min_stock: p.min_stock || 0,
            price: p.price || 0,
            cost: p.cost || 0,
            commission_rate: p.commission_rate || 0,
            status: p.status || 'Ativo',
            imageUrl: p.image_url
        })) : []);
      }
    } catch (e) {
      console.error('Unexpected error loading products:', stringifyError(e));
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    if (!user) return;
    const tempId = crypto.randomUUID();
    const newProduct = { ...productData, id: tempId };
    
    setProducts(prev => [newProduct, ...prev]);

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          id: tempId,
          client_id: user.id,
          name: productData.name,
          category: productData.category,
          stock: productData.stock,
          min_stock: productData.min_stock,
          price: productData.price,
          cost: productData.cost,
          commission_rate: productData.commission_rate,
          status: productData.status || 'Ativo',
          image_url: productData.imageUrl || null
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setProducts(prev => prev.map(p => p.id === tempId ? { ...p, id: data.id } : p));
      }
    } catch (error: any) {
      setProducts(prev => prev.filter(p => p.id !== tempId));
      throw new Error(stringifyError(error));
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try {
      const dbUpdates: any = { ...updates };
      if (updates.imageUrl !== undefined) {
          dbUpdates.image_url = updates.imageUrl;
          delete dbUpdates.imageUrl;
      }
      const { error } = await supabase.from('products').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      fetchProducts(); 
      throw new Error(stringifyError(error));
    }
  };

  const deleteProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      fetchProducts();
      throw error;
    }
  };

  const adjustStock = async (id: string, amount: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newStock = Math.max(0, product.stock + amount);
    await updateProduct(id, { stock: newStock });
  };

  return (
    <ProductContext.Provider value={{ products, isLoading, addProduct, updateProduct, deleteProduct, adjustStock }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used within a ProductProvider');
  return context;
};
