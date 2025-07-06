import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

// Språkdata
const translations = {
  sv: {
    title: "🏠 Skyddsrum Finder",
    subtitle: "Hitta närmaste skyddsrum i Stockholms län",
    findButton: "📍 Hitta närmaste skyddsrum",
    searching: "Söker...",
    searchAgain: "← Sök igen",
    nearestShelterFound: "✅ Närmaste skyddsrum hittat!",
    address: "📍 Adress:",
    capacity: "👥 Kapacitet:",
    type: "🏢 Typ:",
    description: "ℹ️ Beskrivning:",
    municipality: "🏛️ Kommun:",
    navigateButton: "🧭 Navigera med Google Maps",
    importantToKnow: "💡 Viktigt att veta:",
    importantPoints: [
      "Denna app använder din aktuella position för att hitta närmaste skyddsrum",
      "Aktivera platsåtkomst i din webbläsare för att få bästa resultat",
      "Information baseras på MSB:s öppna data",
      "Vid verklig nödsituation, följ myndigheternas anvisningar"
    ],
    version: "Version 1.0.0 | Utvecklad för Stockholms län",
    errors: {
      geolocationNotSupported: "Geolocation stöds inte av denna webbläsare",
      tryModernBrowser: "Prova en modern webbläsare som Chrome, Firefox eller Safari",
      permissionDenied: "Du måste tillåta platsåtkomst för att använda denna funktion",
      positionUnavailable: "Positionsinformation är inte tillgänglig",
      timeout: "Förfrågan om position tog för lång tid",
      unknownError: "Ett okänt fel uppstod vid positionsbestämning",
      checkLocation: "Kontrollera att du har aktiverat platsåtkomst i din webbläsare"
    },
    people: "personer",
    meters: "m",
    kilometers: "km"
  },
  en: {
    title: "🏠 Shelter Finder",
    subtitle: "Find the nearest shelter in Stockholm County",
    findButton: "📍 Find nearest shelter",
    searching: "Searching...",
    searchAgain: "← Search again",
    nearestShelterFound: "✅ Nearest shelter found!",
    address: "📍 Address:",
    capacity: "👥 Capacity:",
    type: "🏢 Type:",
    description: "ℹ️ Description:",
    municipality: "🏛️ Municipality:",
    navigateButton: "🧭 Navigate with Google Maps",
    importantToKnow: "💡 Important to know:",
    importantPoints: [
      "This app uses your current position to find the nearest shelter",
      "Enable location access in your browser for best results",
      "Information is based on MSB's open data",
      "In a real emergency, follow the authorities' instructions"
    ],
    version: "Version 1.0.0 | Developed for Stockholm County",
    errors: {
      geolocationNotSupported: "Geolocation is not supported by this browser",
      tryModernBrowser: "Try a modern browser like Chrome, Firefox or Safari",
      permissionDenied: "You must allow location access to use this feature",
      positionUnavailable: "Position information is not available",
      timeout: "Location request took too long",
      unknownError: "An unknown error occurred during position determination",
      checkLocation: "Check that you have enabled location access in your browser"
    },
    people: "people",
    meters: "m",
    kilometers: "km"
  }
};

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nearestShelter, setNearestShelter] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [isLocationSupported, setIsLocationSupported] = useState(true);
  const [language, setLanguage] = useState('sv');

  const t = translations[language];

  useEffect(() => {
    // Kontrollera om geolocation stöds
    if (!navigator.geolocation) {
      setIsLocationSupported(false);
      setError(t.errors.geolocationNotSupported);
    }
  }, [t.errors.geolocationNotSupported]);

  const toggleLanguage = () => {
    setLanguage(language === 'sv' ? 'en' : 'sv');
  };

  const findNearestShelter = async () => {
    setLoading(true);
    setError('');
    setNearestShelter(null);

    try {
      console.log('🔍 Starting search for nearest shelter...');
      
      // Få användarens position
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      
      console.log('📍 Got user position:', latitude, longitude);
      setUserPosition({ lat: latitude, lng: longitude });

      // Skicka förfrågan till backend
      console.log('🌐 Sending request to API...');
      const response = await axios.post('/api/find-nearest', {
        lat: latitude,
        lng: longitude
      });

      console.log('✅ API response received:', response.data);
      setNearestShelter(response.data.nearestShelters[0]); // Ta första skyddsrummet från listan
      setSearchResults(response.data); // Spara hela resultatet för senare användning
    } catch (err) {
      console.error('❌ Error during search:', err);
      // Visa mer detaljerad felmeddelande
      let errorMessage = err.message || t.errors.unknownError;
      if (err.response) {
        errorMessage = `API Error: ${err.response.status} - ${err.response.statusText}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Test-funktion med hårdkodade koordinater (Stockholm centrum)
  const testWithStockholm = async () => {
    setLoading(true);
    setError('');
    setNearestShelter(null);

    try {
      console.log('🧪 Testing with Stockholm coordinates...');
      const testCoords = { lat: 59.3293, lng: 18.0686 };
      
      setUserPosition(testCoords);

      // Skicka förfrågan till backend
      console.log('🌐 Sending test request to API...');
      const response = await axios.post('/api/find-nearest', testCoords);

      console.log('✅ Test API response received:', response.data);
      setNearestShelter(response.data.nearestShelters[0]); // Ta första skyddsrummet från listan
      setSearchResults(response.data); // Spara hela resultatet
    } catch (err) {
      console.error('❌ Test error:', err);
      let errorMessage = err.message || t.errors.unknownError;
      if (err.response) {
        errorMessage = `API Error: ${err.response.status} - ${err.response.statusText}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(t.errors.geolocationNotSupported));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error(t.errors.permissionDenied));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error(t.errors.positionUnavailable));
              break;
            case error.TIMEOUT:
              reject(new Error(t.errors.timeout));
              break;
            default:
              reject(new Error(t.errors.unknownError));
              break;
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 600000
        }
      );
    });
  };

  const openInGoogleMaps = (shelter) => {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lng}&travelmode=walking`;
    window.open(googleMapsUrl, '_blank');
  };

  const resetSearch = () => {
    setNearestShelter(null);
    setSearchResults(null);
    setError('');
    setUserPosition(null);
  };

  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} ${t.meters}`;
    }
    return `${distance.toFixed(1)} ${t.kilometers}`;
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="language-selector">
            <button 
              className="language-button"
              onClick={toggleLanguage}
              aria-label={language === 'sv' ? 'Switch to English' : 'Växla till svenska'}
            >
              {language === 'sv' ? '🇬🇧 EN' : '🇸🇪 SV'}
            </button>
          </div>
          
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        
        <div className="main-container">
          {!nearestShelter ? (
            <div className="search-section">
              <button 
                className="find-button"
                onClick={findNearestShelter}
                disabled={loading || !isLocationSupported}
              >
                {loading ? (
                  <span>
                    <span className="spinner"></span>
                    {t.searching}
                  </span>
                ) : (
                  t.findButton
                )}
              </button>

              {/* Test-knapp för felsökning */}
              <button 
                className="test-button"
                onClick={testWithStockholm}
                disabled={loading}
                style={{
                  marginTop: '10px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🧪 Test med Stockholm (för felsökning)
              </button>

              {!isLocationSupported && (
                <div className="error-message">
                  <p>⚠️ {t.errors.geolocationNotSupported}</p>
                  <small>{t.errors.tryModernBrowser}</small>
                </div>
              )}
            </div>
          ) : (
            <div className="result-section">
              <button 
                className="reset-button"
                onClick={resetSearch}
              >
                {t.searchAgain}
              </button>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>⚠️ {error}</p>
              <small>{t.errors.checkLocation}</small>
            </div>
          )}

          {nearestShelter && (
            <div className="shelter-info">
              <div className="shelter-header">
                <h2>{t.nearestShelterFound}</h2>
                <div className="distance-badge">
                  {formatDistance(nearestShelter.distance)}
                </div>
              </div>
              
              <div className="shelter-details">
                <h3>{nearestShelter.name}</h3>
                <div className="detail-row">
                  <span className="detail-label">{t.address}</span>
                  <span className="detail-value">{nearestShelter.address}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t.capacity}</span>
                  <span className="detail-value">{nearestShelter.capacity} {t.people}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t.type}</span>
                  <span className="detail-value">{nearestShelter.type}</span>
                </div>
                {nearestShelter.municipality && (
                  <div className="detail-row">
                    <span className="detail-label">{t.municipality}</span>
                    <span className="detail-value">{nearestShelter.municipality}</span>
                  </div>
                )}
                {nearestShelter.description && (
                  <div className="detail-row">
                    <span className="detail-label">{t.description}</span>
                    <span className="detail-value">{nearestShelter.description}</span>
                  </div>
                )}
                
                <button 
                  className="navigate-button"
                  onClick={() => openInGoogleMaps(nearestShelter)}
                >
                  {t.navigateButton}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="app-footer">
          <div className="footer-content">
            <p>
              <strong>{t.importantToKnow}</strong>
            </p>
            <ul>
              {t.importantPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
            <p className="version">
              <small>{t.version}</small>
            </p>
          </div>
        </footer>
      </header>
    </div>
  );
}

export default App;