import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export function useWooProducts() {
  const [wooProducts, setWooProducts] = useState([])
  const [wooLoading, setWooLoading] = useState(true)
  const [wooError, setWooError] = useState(null)

  const fetchWoo = useCallback(async () => {
    setWooLoading(true)
    setWooError(null)
    try {
      const { data, error } = await supabase.functions.invoke('woo-products')
      if (error) throw new Error(error.message)
      setWooProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('WooCommerce sync failed:', err)
      setWooError(err.message)
      setWooProducts([])
    } finally {
      setWooLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWoo()
  }, [fetchWoo])

  return { wooProducts, wooLoading, wooError, refetchWoo: fetchWoo }
}
