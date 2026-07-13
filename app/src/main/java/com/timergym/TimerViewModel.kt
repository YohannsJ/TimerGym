package com.timergym

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class Phase {
    IDLE,
    WORK,
    REST,
    COMPLETED
}

data class Preset(
    val name: String,
    val workSeconds: Int,
    val restSeconds: Int,
    val sets: Int
)

data class TimerUiState(
    val workSeconds: Int = 45,
    val restSeconds: Int = 90,
    val totalSets: Int = 5,
    val currentSet: Int = 1,
    val phase: Phase = Phase.IDLE,
    val remainingSeconds: Int = 45,
    val isRunning: Boolean = false,
    val selectedPreset: String = "Personalizado"
) {
    val totalForPhase: Int
        get() = when (phase) {
            Phase.WORK -> workSeconds
            Phase.REST -> restSeconds
            Phase.IDLE -> workSeconds
            Phase.COMPLETED -> 1
        }

    val progress: Float
        get() = if (totalForPhase <= 0) 0f else remainingSeconds.toFloat() / totalForPhase.toFloat()
}

class TimerViewModel : ViewModel() {
    private var timerJob: Job? = null

    val presets = listOf(
        Preset("Fuerza", 45, 90, 5),
        Preset("HIIT", 30, 30, 10),
        Preset("Tabata", 20, 10, 8)
    )

    private var _uiState = androidx.compose.runtime.mutableStateOf(TimerUiState())
    val uiState: androidx.compose.runtime.State<TimerUiState> = _uiState

    fun applyPreset(preset: Preset) {
        stop()
        _uiState.value = TimerUiState(
            workSeconds = preset.workSeconds,
            restSeconds = preset.restSeconds,
            totalSets = preset.sets,
            currentSet = 1,
            phase = Phase.IDLE,
            remainingSeconds = preset.workSeconds,
            isRunning = false,
            selectedPreset = preset.name
        )
    }

    fun updateWork(seconds: Int) {
        val safe = seconds.coerceIn(5, 3600)
        val state = _uiState.value
        _uiState.value = state.copy(
            workSeconds = safe,
            remainingSeconds = if (state.phase == Phase.IDLE || state.phase == Phase.WORK) {
                state.remainingSeconds.coerceAtMost(safe)
            } else {
                state.remainingSeconds
            },
            selectedPreset = "Personalizado"
        )
    }

    fun updateRest(seconds: Int) {
        val safe = seconds.coerceIn(5, 3600)
        _uiState.value = _uiState.value.copy(
            restSeconds = safe,
            selectedPreset = "Personalizado"
        )
    }

    fun updateSets(sets: Int) {
        val safe = sets.coerceIn(1, 100)
        val state = _uiState.value
        _uiState.value = state.copy(
            totalSets = safe,
            currentSet = state.currentSet.coerceAtMost(safe),
            selectedPreset = "Personalizado"
        )
    }

    fun startOrPause() {
        val state = _uiState.value
        when {
            state.phase == Phase.COMPLETED -> restart()
            state.isRunning -> pause()
            else -> start()
        }
    }

    fun restart() {
        stop()
        val state = _uiState.value
        _uiState.value = state.copy(
            phase = Phase.IDLE,
            currentSet = 1,
            remainingSeconds = state.workSeconds,
            isRunning = false
        )
    }

    fun stop() {
        timerJob?.cancel()
        val state = _uiState.value
        _uiState.value = state.copy(isRunning = false)
    }

    fun cutCurrentPhase() {
        val state = _uiState.value
        if (state.phase == Phase.WORK || state.phase == Phase.REST) {
            moveToNextPhase(state)
        }
    }

    fun adjustCurrentPhaseBy(secondsDelta: Int) {
        val state = _uiState.value
        if (state.phase != Phase.WORK && state.phase != Phase.REST) return

        val adjusted = (state.remainingSeconds + secondsDelta).coerceIn(1, 7200)
        _uiState.value = state.copy(remainingSeconds = adjusted)
    }

    private fun start() {
        val state = _uiState.value
        val newState = if (state.phase == Phase.IDLE) {
            state.copy(phase = Phase.WORK, currentSet = 1, remainingSeconds = state.workSeconds)
        } else {
            state
        }

        _uiState.value = newState.copy(isRunning = true)
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            // Ticks anclados a elapsedRealtime: un delay(1000) puro acumula
            // drift porque cada iteracion tarda 1000ms + tiempo de proceso.
            var nextTickAt = SystemClock.elapsedRealtime() + 1000
            while (isActive) {
                val waitMs = nextTickAt - SystemClock.elapsedRealtime()
                if (waitMs > 0) delay(waitMs)
                val now = SystemClock.elapsedRealtime()
                if (nextTickAt < now - 1000) {
                    // proceso suspendido: re-anclar para no acelerar ticks
                    nextTickAt = now
                }
                nextTickAt += 1000
                val current = _uiState.value
                if (!current.isRunning) continue

                if (current.remainingSeconds > 1) {
                    _uiState.value = current.copy(remainingSeconds = current.remainingSeconds - 1)
                } else {
                    moveToNextPhase(current)
                }
            }
        }
    }

    private fun pause() {
        _uiState.value = _uiState.value.copy(isRunning = false)
    }

    private fun moveToNextPhase(current: TimerUiState) {
        when (current.phase) {
            Phase.WORK -> {
                _uiState.value = current.copy(
                    phase = Phase.REST,
                    remainingSeconds = current.restSeconds
                )
            }

            Phase.REST -> {
                if (current.currentSet < current.totalSets) {
                    _uiState.value = current.copy(
                        phase = Phase.WORK,
                        currentSet = current.currentSet + 1,
                        remainingSeconds = current.workSeconds
                    )
                } else {
                    _uiState.value = current.copy(
                        phase = Phase.COMPLETED,
                        remainingSeconds = 0,
                        isRunning = false
                    )
                    timerJob?.cancel()
                }
            }

            else -> Unit
        }
    }

    override fun onCleared() {
        timerJob?.cancel()
        super.onCleared()
    }
}
