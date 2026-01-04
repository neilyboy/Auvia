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

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

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
