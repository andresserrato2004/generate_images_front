import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // URL base de la API desde variables de entorno
  const API_URL = process.env.REACT_APP_API_URL;

  const [cedula, setCedula] = useState("");
  const [userData, setUserData] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [streamReady, setStreamReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("search"); // "search", "capture", "loading", "result"
  const [message, setMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Mensajes inspiradores para la pantalla de carga
  const inspiringMessages = [
    "✨ Generando tu futuro brillante...",
    "🎓 Preparando tu momento especial...",
    "🌟 Creando recuerdos inolvidables...",
    "🚀 Construyendo tu éxito académico...",
    "💫 Materializando tus logros...",
    "🏆 Celebrando tu dedicación...",
    "🎯 Finalizando tu jornada académica...",
    "🌈 Tu esfuerzo se hace realidad...",
    "📚 Transformando conocimiento en triunfo...",
    "⭐ Iluminando tu camino profesional..."
  ];

  useEffect(() => {
    // Inicializar la cámara cuando se necesite capturar
    if (step === "capture") {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamReady(true);
        }
      }).catch((err) => {
        console.error("Error accessing camera:", err);
        setMessage("Error al acceder a la cámara. Verifica los permisos.");
      });
    }
  }, [step]);

  // Función para manejar la pantalla de carga con progreso
  const startLoadingScreen = (hasExistingPhoto) => {
    setStep("loading");
    setLoadingProgress(0);
    setLoadingMessage(inspiringMessages[0]);
    
    const totalTime = hasExistingPhoto ? 15000 : 85000; // 15s o 1min 35s
    const progressIncrement = 100 / (totalTime / 100); // Actualizar cada 100ms
    const messageChangeInterval = 4000; // Cambiar mensaje cada 4 segundos
    let messageIndex = 0;
    
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const newProgress = prev + progressIncrement;
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 100);
    
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % inspiringMessages.length;
      setLoadingMessage(inspiringMessages[messageIndex]);
    }, messageChangeInterval);
    
    return { progressInterval, messageInterval };
  };

  // Función para verificar si existe el usuario con la cédula
  const verifyUser = async (cedula) => {
    try {
      const response = await axios.post(`${API_URL}/api/ced`, {
        id: cedula
      });
      
      return {
        exists: response.data.exists,
        user: response.data.user,
        success: response.data.success
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          exists: false,
          success: false,
          error: 'Usuario no encontrado con la cédula proporcionada'
        };
      }
      throw error;
    }
  };

  // Función para proceder a la captura de foto
  const proceedToCapture = async () => {
    if (!cedula.trim()) {
      setMessage("Por favor ingresa tu cédula");
      return;
    }
    
    setLoading(true);
    setMessage("");
    
    try {
      // Verificar si el usuario existe
      const userVerification = await verifyUser(cedula);
      
      if (!userVerification.exists) {
        setLoading(false);
        setMessage("Usuario no encontrado con esa cédula. Verifica que el número sea correcto.");
        return;
      }
      
      // Si el usuario existe, guardar sus datos y proceder
      setUserData(userVerification.user);
      setLoading(false);
      setStep("capture");
      
    } catch (error) {
      console.error("Error verificando usuario:", error);
      setLoading(false);
      setMessage("Error al verificar la cédula. Inténtalo de nuevo.");
    }
  };

  const captureAndSend = async () => {
    if (!cedula.trim() || !userData) {
      setMessage("Error: No se ha proporcionado cédula o datos de usuario");
      return;
    }
    
    // Iniciar inmediatamente la pantalla de carga (asumiendo nueva generación)
    const loadingIntervals = startLoadingScreen(false);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("image", blob, "captured.png");

      try {
        console.log(`Enviando foto para cédula: ${cedula}`);
        const response = await axios.post(`${API_URL}/api/photo/${cedula}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        const { image, user, hasExistingPhoto, generated } = response.data;
        
        console.log("Response from backend:", response.data);
        
        // Si tenía foto existente, ajustar el tiempo restante de carga
        if (hasExistingPhoto) {
          // Limpiar intervalos actuales y reiniciar con tiempo más corto
          clearInterval(loadingIntervals.progressInterval);
          clearInterval(loadingIntervals.messageInterval);
          
          // Reiniciar con pantalla de carga más corta
          const shortLoadingIntervals = startLoadingScreen(true);
          
          // Tiempo mínimo para foto existente
          setTimeout(() => {
            clearInterval(shortLoadingIntervals.progressInterval);
            clearInterval(shortLoadingIntervals.messageInterval);
            
            // Guardar datos del usuario
            setUserData(user);
            setGeneratedImage(image);
            setStep("result");
            setLoading(false);
            
            // Mostrar mensaje apropiado
            if (generated) {
              setMessage(`¡Increíble ${user.name}! Tu nueva foto de graduación ha sido generada exitosamente.`);
            } else {
              setMessage(`¡Excelente ${user.name}! Aquí está tu foto de graduación.`);
            }
            
            // Detener la cámara
            if (videoRef.current && videoRef.current.srcObject) {
              const tracks = videoRef.current.srcObject.getTracks();
              tracks.forEach(track => track.stop());
            }
            setStreamReady(false);
          }, 15000);
        } else {
          // Para nueva generación, cuando el backend responde, completar rápidamente
          // Limpiar intervalos actuales
          clearInterval(loadingIntervals.progressInterval);
          clearInterval(loadingIntervals.messageInterval);
          
          // Completar la barra de progreso rápidamente
          const quickComplete = () => {
            setLoadingProgress(100);
            setLoadingMessage("🎉 ¡Listo! Mostrando tu foto de graduación...");
            
            setTimeout(() => {
              // Guardar datos del usuario
              setUserData(user);
              setGeneratedImage(image);
              setStep("result");
              setLoading(false);
              
              // Mostrar mensaje apropiado
              if (generated) {
                setMessage(`¡Increíble ${user.name}! Tu nueva foto de graduación ha sido generada exitosamente.`);
              } else {
                setMessage(`¡Excelente ${user.name}! Aquí está tu foto de graduación.`);
              }
              
              // Detener la cámara
              if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
              }
              setStreamReady(false);
            }, 2000); // 2 segundos para mostrar el 100% y mensaje final
          };
          
          quickComplete();
        }
        
      } catch (err) {
        console.error("Error processing photo:", err);
        
        // Limpiar intervalos de carga en caso de error
        clearInterval(loadingIntervals.progressInterval);
        clearInterval(loadingIntervals.messageInterval);
        
        setLoading(false);
        setStep("capture");
        
        if (err.response?.status === 404) {
          setMessage("Usuario no encontrado con esa cédula. Verifica que el número sea correcto.");
        } else if (err.response?.status === 400) {
          setMessage("Error: " + (err.response.data.error || "Datos inválidos"));
        } else {
          setMessage("Error al procesar la imagen. Inténtalo de nuevo.");
        }
      }
    }, "image/png");
  };

  const restartProcess = () => {
    setStep("search");
    setCedula("");
    setUserData(null);
    setGeneratedImage(null);
    setMessage("");
    setLoadingProgress(0);
    setLoadingMessage("");
    
    // Detener cámara si está activa
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setStreamReady(false);
  };

  const goBack = () => {
    setStep("search");
    setMessage("");
    
    // Detener cámara si está activa
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setStreamReady(false);
  };

  const getMessageClass = () => {
    if (message.includes("Error") || message.includes("no encontrado")) {
      return "message-box message-error";
    } else if (message.includes("Perfecto") || message.includes("Increíble") || message.includes("Excelente")) {
      return "message-box message-success";
    } else if (message.includes("Por favor")) {
      return "message-box message-warning";
    } else {
      return "message-box message-info";
    }
  };

  return (
    <div className="app-container">
      {/* Header - Solo mostrar si NO estamos en la pantalla de resultados */}
      {step !== "result" && (
        <div className="header">
          <h1>📸 Generador de Fotos de Graduación</h1>
          <p>
            Ingresa tu cédula y toma una foto para obtener tu imagen de graduación personalizada con inteligencia artificial
          </p>
        </div>
      )}

      {/* Search Step */}
      {step === "search" && (
        <div className="step-card fade-in">
          <h2>🎓 Paso 1: Ingresar Cédula</h2>
          <div className="search-form">
            <div className="input-group">
              <label>Número de Cédula:</label>
              <input
                type="text"
                placeholder="Ej: 1019762841"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && proceedToCapture()}
              />
            </div>
            <button 
              onClick={proceedToCapture} 
              disabled={loading || !cedula.trim()}
              className="btn btn-primary btn-full"
            >
              {loading ? "🔍 Verificando usuario..." : "🎓 Verificar y Continuar"}
            </button>
          </div>

          {/* Instructions */}
          <div className="instructions">
            <p>
              💡 <strong>Instrucciones:</strong> Ingresa tu cédula para verificar que estés registrado en el sistema. Una vez verificado, podrás tomar una foto para generar tu imagen de graduación personalizada con IA.
            </p>
          </div>

          {/* Message Display */}
          {message && (
            <div className={getMessageClass()}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Capture Step */}
      {step === "capture" && (
        <div className="step-card fade-in">
          <h2>📸 Paso 2: Tomar Foto</h2>
          
          <div className="instructions">
            <p>
              💡 <strong>Instrucciones:</strong> Asegúrate de estar bien iluminado y centrado en la cámara. 
              Esta foto se usará para generar tu imagen de graduación profesional.
            </p>
          </div>

          <div className="video-container">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              className="video-element"
            />
            {!streamReady && (
              <div className="video-placeholder">
                <div className="icon">📹</div>
                <p>Iniciando cámara...</p>
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>

          <div className="action-buttons">
            <button 
              onClick={captureAndSend} 
              disabled={!streamReady || loading}
              className="btn btn-success"
            >
              {loading ? "⏳ Procesando..." : "📸 Tomar Foto y Generar"}
            </button>
            
            <button 
              onClick={goBack}
              className="btn btn-secondary"
            >
              ⬅️ Volver
            </button>
          </div>

          {/* Message Display */}
          {message && (
            <div className={getMessageClass()}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Loading Step */}
      {step === "loading" && (
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-animation">
              <div className="graduation-cap floating-cap">🎓</div>
              <h2>Generando tu Foto de Graduación</h2>
              <p className="loading-message">{loadingMessage}</p>
            </div>

            {/* Progress Bar */}
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <p className="progress-text">
                {Math.round(loadingProgress)}% completado
              </p>
            </div>

            {/* Spinning Elements */}
            <div className="animated-elements">
              <span className="spinning-element">⭐</span>
              <span className="pulsing-element">📚</span>
              <span className="reverse-spin sparkle">🌟</span>
            </div>
          </div>
        </div>
      )}

      {/* Result Step */}
      {step === "result" && userData && (
        <div className="result-card fade-in">
          <h2>✅ ¡Proceso Completado!</h2>
          
          {/* User Info */}
          <div className="user-info">
            <h3>Información del Graduando</h3>
            <div className="user-details">
              <p><strong>Nombre:</strong> {userData.name}</p>
              <p><strong>Carrera:</strong> {userData.career}</p>
            </div>
          </div>

          {/* Generated Image */}
          {generatedImage && (
            <div className="image-container">
              <h3>Tu Foto de Graduación</h3>
              <div className="generated-image-wrapper">
                <img 
                  src={generatedImage} 
                  alt="Foto de graduación" 
                  className="generated-image"
                />
                <div className="image-decoration">🎓</div>
              </div>
            </div>
          )}

    

          {/* Action Buttons */}
          <div className="action-buttons">
            <button 
              onClick={restartProcess}
              className="btn btn-primary"
            >
              🔄 Nueva Foto
            </button>
            
            {generatedImage && (
              <a
                href={generatedImage}
                download={`graduacion_${userData.name}_${userData.cedula}.png`}
                className="btn btn-success"
                style={{ textDecoration: 'none' }}
              >
                💾 Descargar
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
