# ============================================================================
# PORT PHILLIP BAY BENTHIC HABITAT MONITORING — REPRODUCIBLE R ANALYSIS
# ============================================================================
# Run from the repository root.
# This cleaned script preserves the calculations used for the manuscript while
# replacing local Windows paths with repository-relative paths and removing
# abandoned/commented exploratory analyses that were not reported.
#
# Required packages:
# dplyr, caret, ggplot2, tidyr, tidyverse, terra, patchwork, grid
# ============================================================================

output_dir <- "outputs"
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)

# ###########################RESULTS 3.1####################################################
# ============================================================
# TASK 1 & 2: Harmonize classes and compute validation metrics
# Excluding Red Macroalgae (field_code = 8) and Mixed Macroalgae (field_code = 6)
# ============================================================

library(dplyr)
library(caret)

# 1. Load the exported CSV
df <- read.csv("data/validation/validation_2025_4.csv")

nrow(df)

# 1b. Exclude Red Macroalgae (code 8) and Mixed Macroalgae (code 6)
df <- df %>% filter(!(Class %in% c(6, 8)))

# 2. Define mapping from field class NUMERIC CODES (1-12) to dashboard codes (0-8)
code_mapping <- data.frame(
  field_code = 1:12,
  field_name = c(
    'Bare_rocks',
    'Brown Macroalgae',
    'Built_up',
    'Deep_water',
    'Green Macroalgae',
    'Mixed Macroalgae',
    'Mixed Macroalgae on Sediment',
    'Red Macroalgae',
    'Reef',
    'Seagrass',
    'Sediment',
    'Shoreline_veg'
  ),
  dashboard_code = c(
    8,  # Bare_rocks -> Bare rocks
    2,  # Brown Macroalgae -> Ecklonia–Phyllospora
    NA, # Built_up -> exclude
    0,  # Deep_water -> Deep water
    1,  # Green Macroalgae -> Sub-canopy brown & Caulerpa
    4,  # Mixed Macroalgae -> Seaweed on sediment
    4,  # Mixed Macroalgae on Sediment -> Seaweed on sediment
    4,  # Red Macroalgae -> Seaweed on sediment
    5,  # Reef -> Rocky reef
    3,  # Seagrass -> Seagrass beds
    6,  # Sediment -> Sediment
    7   # Shoreline_veg -> Shoreline vegetation
  )
)

# 3. Join mapping to df by field_code (column 'Class')
df <- df %>%
  left_join(code_mapping, by = c("Class" = "field_code")) %>%
  filter(!is.na(dashboard_code))  # remove Built_up (code 3) and any unmapped

# 4. Convert to factors with correct levels (dashboard classes in order)
dashboard_levels <- c(
  'Deep water',
  'Sub-canopy brown & Caulerpa communities',
  'Ecklonia–Phyllospora communities',
  'Sublittoral seagrass beds',
  'Sublittoral seaweed communities on sediment',
  'Rocky reef',
  'Sediment',
  'Shoreline vegetation',
  'Bare rocks'
)

df$reference <- factor(df$dashboard_code, levels = 0:8, labels = dashboard_levels)
df$mapped <- factor(df$mapped_class, levels = 0:8, labels = dashboard_levels)

# 5. Confusion matrix
cm <- confusionMatrix(df$mapped, df$reference)
print(cm)

# 6. Extract matrix for area adjustment (if desired)
cm_matrix <- as.matrix(cm$table)
print(cm_matrix)

# 7. Save results
write.csv(as.data.frame(cm$table), file.path(output_dir, "confusion_matrix_2025_excl_mixed_red.csv"), row.names = FALSE)



#######FOR RESULT 3.2#############################

# Load required libraries
library(ggplot2)
library(tidyr)
library(dplyr)

# Your data from CSV
data <- data.frame(
  Year = 2016:2025,
  Subcanopy_brown = c(3584.29, 3302.80, 2027.60, 3307.92, 1607.65, 1511.85, 1532.55, 1776.99, 4392.82, 4625.97),
  Ecklonia_Phyllospora = c(449.487, 671.859, 1021.94, 766.486, 892.512, 2639.13, 2533.39, 883.349, 1336.37, 897.986),
  Seagrass = c(7643.14, 7585.14, 7805.93, 7702.72, 8132.16, 7593.70, 7714.73, 6716.47, 7380.47, 8306.63),
  Seaweed_on_sediment = c(8070.12, 9485.44, 11855.53, 10847.16, 7409.00, 7777.90, 8169.53, 7912.51, 7549.18, 10898.81),
  Rocky_reef = c(6347.11, 7932.55, 7004.47, 5617.72, 9355.84, 9428.26, 7334.20, 8062.30, 7433.52, 7870.57),
  Sediment = c(70133.70, 65850.91, 65618.28, 66970.24, 70178.84, 72669.33, 66301.58, 72421.00, 69205.57, 65422.04)
)

# Reshape for ggplot
data_long <- data %>%
  pivot_longer(cols = -Year, names_to = "Class", values_to = "Area_ha")

# Clean class names and set factor levels in logical order
# Order by approximate magnitude: Sediment (largest), then vegetated classes by mean area
data_long$Class <- factor(data_long$Class, 
                          levels = c("Sediment", "Seagrass", "Seaweed_on_sediment", "Rocky_reef", "Subcanopy_brown", "Ecklonia_Phyllospora"),
                          labels = c("Sediment", 
                                     "Sublittoral seagrass", 
                                     "Seaweed on sediment", 
                                     "Rocky reef", 
                                     "Sub-canopy brown algae & Caulerpa", 
                                     "Ecklonia–Phyllospora"))

# Create small multiples plot with zero-forced axes and LOESS smoother
p <- ggplot(data_long, aes(x = Year, y = Area_ha)) +
  # Add LOESS smoother to show underlying trend
  geom_smooth(method = "loess", se = TRUE, color = "red", size = 0.8, alpha = 0.2) +
  # Add raw data points and lines
  geom_line(size = 0.8) +
  geom_point(size = 2, aes(color = Class)) +
  facet_wrap(~Class, scales = "free_y", ncol = 2) +
  # Force y-axis to start at zero for all panels
  expand_limits(y = 0) +
  scale_y_continuous(expand = expansion(mult = c(0, 0.05))) +
  theme_bw() +
  theme(
    strip.background = element_rect(fill = "lightgray"),
    strip.text = element_text(size = 12, face = "bold"),
    axis.text.x = element_text(size = 12, angle = 45, hjust = 1, face = "bold" ),
    axis.text.y = element_text(size = 12, face = "bold"),
    axis.title.x = element_text(size = 14, face = "bold"),
    axis.title.y = element_text(size = 14, face = "bold"),
    panel.grid.minor = element_blank(),
    legend.position = "none"  # Remove legend since facets are labeled
  ) +
  labs(
    x = "Year",
    y = "Area (ha)",
    title = "",
    caption = ""
  ) +
  scale_x_continuous(breaks = 2016:2025)

print(p)

# Save the figure
ggsave(file.path(output_dir, "Figure3_Benthic_Trajectories_Improved.png"), p, width = 10, height = 8, dpi = 300)



# Manual calculation of error‑adjusted area estimates (Olofsson et al. 2014)
#Error‑adjusted area estimates for 2025, computed using the independent confusion matrix (Supplementary Table S12) 
#following the methods described in Section 2.2.2

# Confusion matrix (rows = mapped, cols = reference)
# Replace with your matrix from earlier
cm_matrix <- as.matrix(cm$table)

# Updated 2025 mapped areas in the same order as cm_matrix rows
mapped_areas_ha <- c(
  "Deep water" = 94910.010,
  "Sub-canopy brown & Caulerpa communities" = 4625.970,
  "Ecklonia–Phyllospora communities" = 897.986,
  "Sublittoral seagrass beds" = 8306.630,
  "Sublittoral seaweed communities on sediment" = 10898.810,
  "Rocky reef" = 7870.570,
  "Sediment" = 65422.040,
  "Shoreline vegetation" = 410.965,
  "Bare rocks" = 289.024
)

# Force same order as confusion matrix rows
mapped_areas_ha <- mapped_areas_ha[rownames(cm_matrix)]

# Check
print(mapped_areas_ha)
sum(mapped_areas_ha)

# Mapped area proportions (p_i = mapped_area_i / total_map_area)
total_map_area <- sum(mapped_areas_ha)
p <- mapped_areas_ha / total_map_area

# Number of reference samples per mapped class (row sums)
n_i <- rowSums(cm_matrix)

# Adjusted area proportion for class j (column j)
# Formula: p_j_adjusted = sum_i (p_i * (n_ij / n_i))
p_adj <- numeric(ncol(cm_matrix))
for (j in 1:ncol(cm_matrix)) {
  p_adj[j] <- sum(p * cm_matrix[, j] / n_i)
}

# Adjusted area in hectares
adj_area_ha <- p_adj * total_map_area

# Standard error for adjusted proportion (formula 5 in Olofsson et al. 2014)
se_p <- numeric(ncol(cm_matrix))
for (j in 1:ncol(cm_matrix)) {
  term <- 0
  for (i in 1:nrow(cm_matrix)) {
    if (n_i[i] > 1) {
      term <- term + p[i]^2 * (cm_matrix[i, j] / n_i[i]) * (1 - cm_matrix[i, j] / n_i[i]) / (n_i[i] - 1)
    }
  }
  se_p[j] <- sqrt(term)
}

# Standard error in hectares
se_ha <- se_p * total_map_area

# 95% confidence interval
z <- 1.96
ci_lower <- adj_area_ha - z * se_ha
ci_upper <- adj_area_ha + z * se_ha

# Combine results
adjusted <- data.frame(
  class = colnames(cm_matrix),
  mapped_area_ha = as.numeric(mapped_areas_ha),
  adj_area_ha = as.numeric(adj_area_ha),
  se_ha = as.numeric(se_ha),
  ci_lower = as.numeric(ci_lower),
  ci_upper = as.numeric(ci_upper),
  row.names = NULL
)


print(adjusted)
write.csv(adjusted, file.path(output_dir, "error_adjusted_areas_2025_manual.csv"), row.names = FALSE)





#######################RESULT FOR 3.3############################################

# Optional: Calculate and display variability metrics for each class
variability <- data_long %>%
  group_by(Class) %>%
  summarise(
    Mean_area = mean(Area_ha),
    SD_area = sd(Area_ha),
    CV_percent = (SD_area / Mean_area) * 100,
    Min_year = Year[which.min(Area_ha)],
    Max_year = Year[which.max(Area_ha)]
  )

print(variability)




##########################RESULT 3.4#########################################
library(tidyverse)

# ------------------------------------------------
# 1. Create dataframe directly from your table
# ------------------------------------------------

df <- tribble(
  ~Year, ~Sub_canopy_brown_and_Caulerpa_Biotope, ~Ecklonia_Phyllospora_Communities,
  ~Sublittoral_Seagrass_Beds, ~Sublittoral_SeaweedCommunities_onSediment,
  ~RockyReef, ~Sediment,
  
  2017, -281.482, 222.373, -58.006, 1415.32, 1585.43, -4282.79,
  2018, -1275.20, 350.082, 220.793, 2370.09, -928.076, -232.633,
  2019, 1280.32, -255.456, -103.208, -1008.37, -1386.75, 1351.97,
  2020, -1700.28, 126.027, 429.44, -3438.16, 3738.12, 3208.60,
  2021, -95.793, 1746.62, -538.466, 368.895, 72.418, 2490.50,
  2022, 20.692, -105.745, 121.038, 391.636, -2094.06, -6367.75,
  2023, 244.442, -1650.04, -998.267, -257.027, 728.104, 6119.42,
  2024, 2615.83, 453.018, 664.002, -363.323, -628.778, -3215.43,
  2025, 233.144, -438.38, 926.156, 3349.63, 437.048, -3783.53
)

# ------------------------------------------------
# 2. Convert to long format
# ------------------------------------------------

df_long <- df %>%
  pivot_longer(
    cols = -Year,
    names_to = "Class",
    values_to = "Delta_ha"
  )

# ------------------------------------------------
# 3. Clean class labels for the legend
# ------------------------------------------------

df_long$Class <- recode(df_long$Class,
                        "Sub_canopy_brown_and_Caulerpa_Biotope" = "Sub-canopy brown algae & Caulerpa",
                        "Ecklonia_Phyllospora_Communities" = "Ecklonia–Phyllospora",
                        "Sublittoral_Seagrass_Beds" = "Sublittoral seagrass beds",
                        "Sublittoral_SeaweedCommunities_onSediment" = "Seaweed communities on sediment",
                        "RockyReef" = "Rocky reef",
                        "Sediment" = "Sediment"
)

# ------------------------------------------------
# 4. Determine symmetric axis range
# ------------------------------------------------

max_abs <- ceiling(max(abs(df_long$Delta_ha)) / 1000) * 1000

# ------------------------------------------------
# 5. Plot
# ------------------------------------------------

p <- ggplot(df_long, aes(x = factor(Year), y = Delta_ha, fill = Class)) +
  
  geom_col(
    position = position_dodge(width = 0.8),
    width = 0.75
  ) +
  
  # Bold zero line
  geom_hline(yintercept = 0, linewidth = 1, colour = "black") +
  
  # Gain / loss labels
  annotate("text", x = 1, y = max_abs * 0.9,
           label = "Habitat gain (+)", hjust = 0, size = 4.5) +
  
  annotate("text", x = 1, y = -max_abs * 1,
           label = "Habitat loss (–)", hjust = 0, size = 4.5) +
  
  scale_y_continuous(
    limits = c(-max_abs, max_abs),
    breaks = scales::pretty_breaks(n = 8)
  ) +
  
  labs(
    x = "Year",
    y = expression(Delta * " Area (ha)"),
    fill = NULL,
    title = ""
  ) +
  
  theme_bw(base_size = 13) +
  theme(
    legend.position = "top",
    legend.text = element_text(size = 11, face = "bold"),
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_blank(),
    plot.title = element_text(face = "bold"),
    axis.text.x = element_text(size = 10.5, face = "bold"),
    axis.text.y = element_text(size = 10.5, face = "bold"),
    axis.title.x = element_text(size = 14, face = "bold"),
    axis.title.y = element_text(size = 14, face = "bold")
  )

print(p)

# ------------------------------------------------
# 6. Save publication-quality figure
# ------------------------------------------------

ggsave("Year_to_Year_Habitat_Delta.png", p, width = 12, height = 8, dpi = 600)
ggsave("Year_to_Year_Habitat_Delta.pdf", p, width = 12, height = 8)





###########################RESULTS 3.6###########################
# ============================================================
# TASK 4: Sensitivity Analysis - R Analysis
# ============================================================

library(dplyr)
library(tidyr)
library(ggplot2)

# List of years
years <- c(2016, 2019, 2023)

# Initialize empty data frame
all_data <- data.frame()

for (y in years) {
  file_path <- file.path("data", "sensitivity", paste0("sensitivity2_", y, ".csv"))
  
  df <- read.csv(file_path)
  
  all_data <- rbind(all_data, df)
}



# View structure
head(all_data)

# Pivot to compare median vs p25 for each year and class
comparison <- all_data %>%
  pivot_wider(id_cols = c(year, class), names_from = method, values_from = area_ha) %>%
  mutate(
    diff_ha = p25 - median,
    pct_diff = (p25 - median) / median * 100
  )

print(comparison)

# Summary statistics
summary_stats <- comparison %>%
  group_by(class) %>%
  summarise(
    mean_pct_diff = mean(pct_diff, na.rm = TRUE),
    sd_pct_diff = sd(pct_diff, na.rm = TRUE),
    max_abs_diff = max(abs(pct_diff), na.rm = TRUE)
  )
print(summary_stats)

# Plot
ggplot(comparison, aes(x = factor(class), y = pct_diff, fill = factor(year))) +
  geom_bar(stat = 'identity', position = position_dodge()) +
  labs(title = '',#Sensitivity Analysis: 25th Percentile vs Median Composite',
       x = 'Class Code', y = 'Percent Difference (%)',
       fill = 'Year') +
  theme_bw() +
  theme(legend.text = element_text(size = 12, face = "bold"),
        legend.title = element_text(size = 14, face = "bold"),
        axis.text.x = element_text(size = 12, angle = 45, hjust = 1, face = "bold"),
        axis.text.y = element_text(size = 12, face = "bold"),
        axis.title.x = element_text(size = 14, face = "bold"),
        axis.title.y = element_text(size = 14, face = "bold"),
        )



# Compute mean absolute percent difference
comparison_abs <- comparison %>%
  group_by(class) %>%
  summarise(
    mean_abs_pct_diff = mean(abs(pct_diff), na.rm = TRUE),
    max_abs_diff = max(abs(pct_diff), na.rm = TRUE)  # you already have this in summary_stats
  )
print(comparison_abs)
write.csv(comparison, file.path(output_dir, "compositing_sensitivity_comparison.csv"), row.names = FALSE)
write.csv(comparison_abs, file.path(output_dir, "compositing_sensitivity_summary.csv"), row.names = FALSE)



# ============================================================
# TASK 5: Optical Confounding - Correlation Analysis
# ============================================================

library(dplyr)
library(tidyr)
library(ggplot2)

# 1. Load annual area data (wide format)
areas_wide <- read.csv("data/annual/annual_areas2.csv", 
                       check.names = FALSE, stringsAsFactors = FALSE)

# Clean the year column (remove comma and convert to integer)
areas_wide$year <- as.integer(gsub(",", "", areas_wide$year))

# Clean all area columns: remove commas and convert to numeric
for (col in names(areas_wide)[-1]) {
  areas_wide[[col]] <- as.numeric(gsub(",", "", areas_wide[[col]]))
}

# Reshape to long format and assign clean class names
areas_long <- areas_wide %>%
  pivot_longer(cols = -year, names_to = "class_raw", values_to = "area_ha") %>%
  mutate(
    class = case_when(
      class_raw == "Deep_water" ~ 0,
      class_raw == "Sub_canopy_brown_and_Caulerpa_Biotope" ~ 1,
      class_raw == "Ecklonia_Phyllospora_Communities" ~ 2,
      class_raw == "Sublittoral_Seagrass_Beds" ~ 3,
      class_raw == "Sublittoral_SeaweedCommunities_onSediment" ~ 4,
      class_raw == "RockyReef" ~ 5,
      class_raw == "Sediment" ~ 6,
      class_raw == "Shoreline_veg" ~ 7,
      class_raw == "Bare_rocks" ~ 8,
      TRUE ~ NA_real_
    ),
    class_name = case_when(
      class == 0 ~ "Deep water",
      class == 1 ~ "Sub-canopy brown algae & Caulerpa communities",
      class == 2 ~ "Ecklonia–Phyllospora communities",
      class == 3 ~ "Sublittoral seagrass beds",
      class == 4 ~ "Sublittoral seaweed communities on sediment",
      class == 5 ~ "Rocky reef",
      class == 6 ~ "Sediment",
      class == 7 ~ "Shoreline vegetation",
      class == 8 ~ "Bare rocks",
      TRUE ~ NA_character_
    )
  ) %>%
  filter(!is.na(class))

# 2. Load turbidity data (once you have it)
turb <- read.csv("data/annual/annual_turbidity.csv")

# 3. Merge
df <- merge(areas_long, turb, by = "year")

# 4. Compute Spearman correlation per class
cor_results <- df %>%
  group_by(class, class_name) %>%
  summarise(
    rho = cor(turbidity, area_ha, method = "spearman", use = "complete.obs"),
    p_value = cor.test(turbidity, area_ha, method = "spearman")$p.value,
    .groups = "drop"
  ) %>%
  arrange(class)

print(cor_results)

# 5. Plot for key macroalgal classes
ggplot(df %>% filter(class %in% c(1,2,3,4,5,6)), 
       aes(x = turbidity, y = area_ha, color = factor(class))) +
  geom_point() +
  geom_smooth(method = "lm", se = FALSE) +
  facet_wrap(~class_name, scales = "free_y") +
  labs(x = "Turbidity (Red/Green)", y = "Area (ha)", color = "Class") +
  theme_bw() +
  theme(strip.background = element_rect(fill = "lightgray"),
        strip.text = element_text(size = 12, face = "bold"),
        legend.text = element_text(size = 12, face = "bold"),
        legend.title = element_text(size = 14, face = "bold"),
        axis.text.x = element_text(size = 12, face = "bold"),
        axis.text.y = element_text(size = 12, face = "bold"),
        axis.title.x = element_text(size = 14, face = "bold"),
        axis.title.y = element_text(size = 14, face = "bold"),
        legend.position = "none"
  )

# 6. Save results
write.csv(cor_results, file.path(output_dir, "turbidity_correlations.csv"), row.names = FALSE)




# ============================================================
# Figure S3: Persistence and modal class maps, vertical layout
# Manual north arrow and scale bar, no ggspatial required
# ============================================================

library(terra)
library(ggplot2)
library(dplyr)
library(patchwork)
library(grid)

# Load rasters
persistence_map <- rast("data/persistence/PPB_Persistence_Map_2016_2025_2.tif")
modal_map <- rast("data/persistence/PPB_Modal_Class_Map_2016_2025_2.tif")

# Assign CRS if missing
if (is.na(crs(persistence_map))) crs(persistence_map) <- "EPSG:4326"
if (is.na(crs(modal_map))) crs(modal_map) <- "EPSG:4326"

# Use persistence map as mask so modal background outside PPB becomes white
modal_map <- mask(modal_map, persistence_map)

# Convert to data frames
persistence_df <- as.data.frame(persistence_map, xy = TRUE, na.rm = TRUE)
modal_df <- as.data.frame(modal_map, xy = TRUE, na.rm = TRUE)

names(persistence_df)[3] <- "persistence"
names(modal_df)[3] <- "class"

# Factor levels
persistence_df$persistence <- factor(persistence_df$persistence, levels = 2:10)

modal_df$class <- factor(
  modal_df$class,
  levels = 0:8,
  labels = c(
    "Deep water",
    "Sub-canopy brown algae & Caulerpa",
    "Ecklonia–Phyllospora",
    "Sublittoral seagrass",
    "Seaweed on sediment",
    "Rocky reef",
    "Sediment",
    "Shoreline vegetation",
    "Bare rocks"
  )
)

# Colours
persistence_cols <- c(
  "2" = "red",
  "3" = "orangered",
  "4" = "orange",
  "5" = "gold",
  "6" = "yellow",
  "7" = "yellowgreen",
  "8" = "limegreen",
  "9" = "forestgreen",
  "10" = "darkgreen"
)

modal_cols <- c(
  "Deep water" = "#0000FF",
  "Sub-canopy brown algae & Caulerpa" = "#00FF00",
  "Ecklonia–Phyllospora" = "#8B4513",
  "Sublittoral seagrass" = "#228B22",
  "Seaweed on sediment" = "#FFD700",
  "Rocky reef" = "#00CED1",
  "Sediment" = "#C2B280",
  "Shoreline vegetation" = "#a9c994",
  "Bare rocks" = "#000000"
)

# Map extent
x_min <- min(persistence_df$x, na.rm = TRUE)
x_max <- max(persistence_df$x, na.rm = TRUE)
y_min <- min(persistence_df$y, na.rm = TRUE)
y_max <- max(persistence_df$y, na.rm = TRUE)

# Manual north arrow position
na_x <- x_min + 0.04 * (x_max - x_min)
na_y <- y_max - 0.06 * (y_max - y_min)

# Manual scale bar position
sb_x0 <- x_min + 0.30 * (x_max - x_min)
sb_x1 <- sb_x0 + 0.18  # approx 15–16 km at this latitude
sb_y  <- y_min + 0.08 * (y_max - y_min)

# Helper function for manual map annotations
add_map_annotations <- function(p) {
  p +
    annotate(
      "segment",
      x = na_x, xend = na_x,
      y = na_y - 0.045, yend = na_y,
      arrow = arrow(length = unit(0.25, "cm")),
      linewidth = 0.8
    ) +
    annotate(
      "text",
      x = na_x,
      y = na_y + 0.02,
      label = "N",
      fontface = "bold",
      size = 4
    ) +
    annotate(
      "segment",
      x = sb_x0, xend = sb_x1,
      y = sb_y, yend = sb_y,
      linewidth = 0.8
    ) +
    annotate(
      "segment",
      x = sb_x0, xend = sb_x0,
      y = sb_y - 0.01, yend = sb_y + 0.01,
      linewidth = 0.8
    ) +
    annotate(
      "segment",
      x = sb_x1, xend = sb_x1,
      y = sb_y - 0.01, yend = sb_y + 0.01,
      linewidth = 0.8
    ) +
    annotate(
      "text",
      x = (sb_x0 + sb_x1) / 2,
      y = sb_y + 0.025,
      label = "≈ 15 km",
      size = 3.2,
      fontface = "bold"
    )
}

# Panel A: Persistence
p1 <- ggplot() +
  geom_raster(data = persistence_df, aes(x = x, y = y, fill = persistence)) +
  scale_fill_manual(
    values = persistence_cols,
    name = "Persistence\n2016–2025\n(years)",
    drop = FALSE,
    na.value = "white"
  ) +
  coord_equal(expand = FALSE) +
  labs(title = "(a) Persistence") +
  theme_bw() +
  theme(
    plot.title = element_text(size = 15, face = "bold", hjust = 0.5),
    axis.title = element_blank(),
    axis.text = element_text(size = 9),
    legend.position = c(0.16, 0.25),
    legend.background = element_rect(fill = "white", colour = NA),
    legend.title = element_text(size = 9, face = "bold"),
    legend.text = element_text(size = 8),
    panel.grid = element_blank()
  )

p1 <- add_map_annotations(p1)
print(p1)

# Panel B: Modal class
p2 <- ggplot() +
  geom_raster(data = modal_df, aes(x = x, y = y, fill = class)) +
  scale_fill_manual(
    values = modal_cols,
    name = "Modal class",
    drop = FALSE,
    na.value = "white"
  ) +
  coord_equal(expand = FALSE) +
  labs(title = "(b) Modal habitat class") +
  theme_bw() +
  theme(
    plot.title = element_text(size = 15, face = "bold", hjust = 0.5),
    axis.title = element_blank(),
    axis.text = element_text(size = 9),
    legend.position = "right",
    legend.title = element_text(size = 9, face = "bold"),
    legend.text = element_text(size = 8),
    panel.grid = element_blank()
  )

p2 <- add_map_annotations(p2)
print(p2)

# Combine vertically
fig_s3 <- p1 / p2

# Plot for checking
print(fig_s3)

# Save Figure S3
ggsave(
  filename = file.path(output_dir, "Figure_S3_Persistence_and_Modal_Map_2016_2025.png"),
  plot = fig_s3,
  width = 8,
  height = 12,
  dpi = 300
)





