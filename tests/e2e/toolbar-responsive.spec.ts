import { test, expect } from '@playwright/test';

test.describe('Toolbar Responsive Behavior', () => {
	test('should show top toolbar with utility features on all screen sizes', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Check that top toolbar is always visible
		const topToolbar = page.locator('.toolbar-top');
		await expect(topToolbar).toBeVisible();

		// Check for essential utility features
		await expect(page.locator('button[title="Upload PDF"]')).toBeVisible();
		await expect(page.locator('button[title="Previous page"]')).toBeVisible();
		await expect(page.locator('button[title="Next page"]')).toBeVisible();
		await expect(page.locator('button[title="Zoom out"]')).toBeVisible();
		await expect(page.locator('button[title="Zoom in"]')).toBeVisible();
		await expect(page.locator('button[title="Undo (Ctrl+Z)"]')).toBeVisible();
		await expect(page.locator('button[title="Redo (Ctrl+Y)"]')).toBeVisible();
	});

	test('should hide drawing tools in top toolbar on small screens', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set to mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Wait for responsive changes
		await page.waitForTimeout(100);

		// Drawing tools should be hidden in top toolbar on small screens
		const drawingToolsInTop = page.locator('.toolbar-top .hidden.lg\\:flex');
		await expect(drawingToolsInTop).toBeVisible(); // The container exists but is hidden

		// Check that specific drawing tools are not visible in top toolbar
		await expect(page.locator('.toolbar-top button[title="Pencil (1)"]')).not.toBeVisible();
		await expect(page.locator('.toolbar-top button[title="Eraser (2)"]')).not.toBeVisible();
		await expect(page.locator('.toolbar-top button[title="Text (3)"]')).not.toBeVisible();
	});

	test('should show bottom toolbar with drawing tools on small screens', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set to mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Wait for responsive changes
		await page.waitForTimeout(100);

		// Bottom toolbar should be visible on small screens
		const bottomToolbar = page.locator('.toolbar-bottom');
		await expect(bottomToolbar).toBeVisible();

		// Check for drawing tools in bottom toolbar
		await expect(page.locator('.toolbar-bottom button[title="Pencil (1)"]')).toBeVisible();
		await expect(page.locator('.toolbar-bottom button[title="Eraser (2)"]')).toBeVisible();
		await expect(page.locator('.toolbar-bottom button[title="Text (3)"]')).toBeVisible();
		await expect(page.locator('.toolbar-bottom button[title="Arrow (4)"]')).toBeVisible();
		await expect(page.locator('.toolbar-bottom button[title="Highlighter (8)"]')).toBeVisible();
		await expect(page.locator('.toolbar-bottom button[title="Sticky Note (9)"]')).toBeVisible();
	});

	test('should hide bottom toolbar on large screens', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set to desktop viewport
		await page.setViewportSize({ width: 1920, height: 1080 });

		// Wait for responsive changes
		await page.waitForTimeout(100);

		// Bottom toolbar should be hidden on large screens
		const bottomToolbar = page.locator('.toolbar-bottom');
		await expect(bottomToolbar).not.toBeVisible();
	});

	test('should show drawing tools in top toolbar on large screens', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set to desktop viewport
		await page.setViewportSize({ width: 1920, height: 1080 });

		// Wait for responsive changes
		await page.waitForTimeout(100);

		// Drawing tools should be visible in top toolbar on large screens
		await expect(page.locator('.toolbar-top button[title="Pencil (1)"]')).toBeVisible();
		await expect(page.locator('.toolbar-top button[title="Eraser (2)"]')).toBeVisible();
		await expect(page.locator('.toolbar-top button[title="Text (3)"]')).toBeVisible();
		await expect(page.locator('.toolbar-top button[title="Arrow (4)"]')).toBeVisible();
		await expect(page.locator('.toolbar-top button[title="Highlighter (8)"]')).toBeVisible();
		await expect(page.locator('.toolbar-top button[title="Sticky Note (9)"]')).toBeVisible();
	});

	test('should handle responsive breakpoints correctly', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Test tablet viewport (lg breakpoint)
		await page.setViewportSize({ width: 1024, height: 768 });
		await page.waitForTimeout(100);

		// At lg breakpoint, drawing tools should be in top toolbar
		await expect(page.locator('.toolbar-top button[title="Pencil (1)"]')).toBeVisible();
		await expect(page.locator('.toolbar-bottom')).not.toBeVisible();

		// Test mobile viewport (below lg breakpoint)
		await page.setViewportSize({ width: 1023, height: 768 });
		await page.waitForTimeout(100);

		// Below lg breakpoint, drawing tools should be in bottom toolbar
		await expect(page.locator('.toolbar-top button[title="Pencil (1)"]')).not.toBeVisible();
		await expect(page.locator('.toolbar-bottom button[title="Pencil (1)"]')).toBeVisible();
	});

	test('should maintain functionality when switching between toolbar layouts', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Start with desktop view
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.waitForTimeout(100);

		// Select pencil tool from top toolbar
		await page.locator('.toolbar-top button[title="Pencil (1)"]').click();
		await expect(page.locator('.toolbar-top button[title="Pencil (1)"]')).toHaveClass(/active/);

		// Switch to mobile view
		await page.setViewportSize({ width: 375, height: 667 });
		await page.waitForTimeout(100);

		// Pencil tool should still be active in bottom toolbar
		await expect(page.locator('.toolbar-bottom button[title="Pencil (1)"]')).toHaveClass(/active/);

		// Switch back to desktop view
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.waitForTimeout(100);

		// Pencil tool should still be active in top toolbar
		await expect(page.locator('.toolbar-top button[title="Pencil (1)"]')).toHaveClass(/active/);
	});
});
