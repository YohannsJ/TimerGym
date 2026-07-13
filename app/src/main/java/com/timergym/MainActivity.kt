package com.timergym

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.timergym.ui.theme.TimerGymTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TimerGymTheme {
                val vm: TimerViewModel = viewModel()
                TimerScreen(vm)
            }
        }
    }
}

@Composable
fun TimerScreen(vm: TimerViewModel) {
    val state = vm.uiState.value

    var workInput by remember(state.workSeconds) { mutableStateOf(state.workSeconds.toString()) }
    var restInput by remember(state.restSeconds) { mutableStateOf(state.restSeconds.toString()) }
    var setsInput by remember(state.totalSets) { mutableStateOf(state.totalSets.toString()) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF0E1726), Color(0xFF1B263B), Color(0xFF415A77))
                )
            )
            .padding(horizontal = 16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(28.dp))
            Text(
                text = "TimerGym",
                style = MaterialTheme.typography.headlineMedium,
                color = Color(0xFFE0E1DD),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Preset: ${state.selectedPreset}",
                color = Color(0xFFB8C1CC)
            )

            Spacer(Modifier.height(22.dp))
            CircularTimer(
                remaining = state.remainingSeconds,
                progress = state.progress,
                phase = state.phase,
                currentSet = state.currentSet,
                totalSets = state.totalSets
            )

            Spacer(Modifier.height(20.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Programar sets", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = workInput,
                        onValueChange = {
                            workInput = it.filter { c -> c.isDigit() }
                            workInput.toIntOrNull()?.let(vm::updateWork)
                        },
                        label = { Text("Trabajo (segundos)") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = restInput,
                        onValueChange = {
                            restInput = it.filter { c -> c.isDigit() }
                            restInput.toIntOrNull()?.let(vm::updateRest)
                        },
                        label = { Text("Descanso (segundos)") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = setsInput,
                        onValueChange = {
                            setsInput = it.filter { c -> c.isDigit() }
                            setsInput.toIntOrNull()?.let(vm::updateSets)
                        },
                        label = { Text("Cantidad de sets") },
                        singleLine = true
                    )
                }
            }

            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                vm.presets.forEach { preset ->
                    AssistChip(
                        onClick = { vm.applyPreset(preset) },
                        label = { Text(preset.name) }
                    )
                }
            }

            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    modifier = Modifier.weight(1f),
                    onClick = vm::startOrPause
                ) {
                    Text(if (state.isRunning) "Pausar" else "Iniciar")
                }
                TextButton(
                    modifier = Modifier.weight(1f),
                    onClick = vm::restart
                ) {
                    Text("Reiniciar")
                }
            }

            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TextButton(modifier = Modifier.weight(1f), onClick = { vm.adjustCurrentPhaseBy(-5) }) {
                    Text("-5s")
                }
                TextButton(modifier = Modifier.weight(1f), onClick = { vm.adjustCurrentPhaseBy(5) }) {
                    Text("+5s")
                }
                TextButton(modifier = Modifier.weight(1f), onClick = vm::cutCurrentPhase) {
                    Text("Cortar fase")
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun CircularTimer(
    remaining: Int,
    progress: Float,
    phase: Phase,
    currentSet: Int,
    totalSets: Int
) {
    val animatedProgress by animateFloatAsState(
        targetValue = progress.coerceIn(0f, 1f),
        animationSpec = tween(500),
        label = "timerProgress"
    )

    val phaseColor = when (phase) {
        Phase.WORK -> Color(0xFFEF8354)
        Phase.REST -> Color(0xFF2A9D8F)
        Phase.COMPLETED -> Color(0xFFFFD166)
        Phase.IDLE -> Color(0xFF9AA6B2)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(250.dp)) {
                Canvas(modifier = Modifier.matchParentSize()) {
                    val stroke = 18.dp.toPx()
                    drawCircle(
                        color = Color(0xFFDCE2EA),
                        style = Stroke(width = stroke)
                    )
                    drawArc(
                        color = phaseColor,
                        startAngle = -90f,
                        sweepAngle = 360 * animatedProgress,
                        useCenter = false,
                        topLeft = Offset(stroke / 2, stroke / 2),
                        size = Size(size.width - stroke, size.height - stroke),
                        style = Stroke(width = stroke, cap = StrokeCap.Round)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = formatTime(remaining),
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = when (phase) {
                            Phase.WORK -> "ENTRENAR"
                            Phase.REST -> "DESCANSO"
                            Phase.COMPLETED -> "COMPLETADO"
                            Phase.IDLE -> "PREPARADO"
                        },
                        color = phaseColor,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(text = "Set $currentSet / $totalSets")
                }
            }
        }
    }
}

private fun formatTime(totalSeconds: Int): String {
    val safe = totalSeconds.coerceAtLeast(0)
    val minutes = safe / 60
    val seconds = safe % 60
    return "%02d:%02d".format(minutes, seconds)
}
