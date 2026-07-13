package com.timergym.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val TimerColorScheme = darkColorScheme(
    primary = Ice,
    secondary = SlateBlue,
    background = DeepNavy
)

@Composable
fun TimerGymTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TimerColorScheme,
        typography = Typography,
        content = content
    )
}
