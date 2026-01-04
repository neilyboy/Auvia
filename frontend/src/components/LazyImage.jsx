import { useState, useEffect, useRef } from 'react'

export default function LazyImage({ 
  src, 
  alt, 
  className = '', 
  placeholderClassName = '',
  fallback = null 
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef(null)

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
  }, [src])

  useEffect(() => {
    const element = imgRef.current
    if (!element) return

    // Check if already in view immediately (fixes first-render issue)
    const rect = element.getBoundingClientRect()
    const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100 &&
                      rect.left < window.innerWidth + 100 && rect.right > -100
    
    if (isVisible) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.01
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [src])

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true)
  }

  if (hasError && fallback) {
    return fallback
  }

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {/* Skeleton placeholder */}
      {!isLoaded && (
        <div className={`absolute inset-0 bg-auvia-card animate-pulse ${placeholderClassName}`} />
      )}
      
      {/* Actual image - only load src when in view */}
      {isInView && src && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {/* Fallback for no src */}
      {(!src || hasError) && isLoaded && fallback}
    </div>
  )
}
