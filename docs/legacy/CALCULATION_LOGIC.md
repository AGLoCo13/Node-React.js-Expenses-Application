# Calculation Logic - Presidential Decree 1985

## 📐 Overview

This document explains the mathematical formulas used for calculating heating, elevator, and general expenses in the UrbanSync application, based on **Presidential Decree 1985** (Greek law for building common expenses).

---

## 🔥 **1. HEATING CALCULATION**

### Formula (PD 1985):
```
Heating Cost = Variable Part (70%) + Fixed Part (30%)

Where:
  Variable Part = [(ei × Wi) / Σ(ei × Wi)] × 0.70 × P
  Fixed Part    = [(fi × ei) / Σ(fi × ei)] × 0.30 × P
```

### Parameters:
- **ei** = Volume coefficient (0.40 - 0.85) - From mechanical engineer's heating study
- **fi** = Position coefficient (0.20 - 0.35) - Based on apartment location in building
- **Wi** = Hours of consumption (from hourly meter)
- **P** = Total heating fuel cost (€)
- **Σ** = Sum of all apartments

### Why 70%-30%?
- **70% Variable**: Proportional to actual consumption - rewards conservation
- **30% Fixed**: Even non-users pay something (they affect neighbors' heating loss, system was sized for all apartments)

---

## 🏢 **2. ELEVATOR CALCULATION**

### Formula:
```
Elevator Cost = (Floor / Σ(Floors)) × P  (for apartments where floor > 0)
                0                         (for ground floor)

Where:
  P = Total elevator expenses (€)
  Σ(Floors) = Sum of floor numbers for all apartments above ground
```

### Logic:
- Ground floor (floor = 0) pays **€0** - doesn't use elevator
- Higher floors pay **proportionally more** (based on floor number)
- A 2nd floor apartment pays **2x** what a 1st floor pays
- This is the **most common method in Greece**

---

## 💼 **3. GENERAL EXPENSES CALCULATION**

### Formula:
```
General Cost = (Square Meters / Total Square Meters) × P

Where:
  P = Total general expenses (€)
```

### Logic:
- Proportional to apartment size
- Includes: cleaning, lighting, water, maintenance, etc.
- Based on Law 3741/1929 Article 5

---

## 📊 **CALCULATION EXAMPLE**

### Building Setup:
```
Total Heating Cost: €1,000
Total Elevator Cost: €200
Total General Cost: €300
```

### Apartments:

| Apartment | Floor | m² | ei | fi | Consumption (hrs) |
|-----------|-------|-----|-----|-----|-------------------|
| A         | 1     | 100 | 0.75| 0.25| 84                |
| B         | 0     | 80  | 0.65| 0.25| 60                |
| C         | 2     | 60  | 0.50| 0.30| 110               |

---

### Step-by-Step Calculation:

#### **HEATING:**

**Step 1: Calculate Σ(ei × Wi)**
```
Apartment A: 0.75 × 84  = 63.00
Apartment B: 0.65 × 60  = 39.00
Apartment C: 0.50 × 110 = 55.00
                Total = 157.00
```

**Step 2: Calculate Σ(fi × ei)**
```
Apartment A: 0.25 × 0.75 = 0.1875
Apartment B: 0.25 × 0.65 = 0.1625
Apartment C: 0.30 × 0.50 = 0.1500
                   Total = 0.5000
```

**Step 3: Calculate for Apartment A**
```
Variable (70%): (63.00 / 157.00) × 0.70 × 1000 = €280.89
Fixed (30%):    (0.1875 / 0.5000) × 0.30 × 1000 = €112.50
Total Heating A: €393.39
```

**Step 4: Calculate for Apartment B**
```
Variable (70%): (39.00 / 157.00) × 0.70 × 1000 = €173.89
Fixed (30%):    (0.1625 / 0.5000) × 0.30 × 1000 = €97.50
Total Heating B: €271.39
```

**Step 5: Calculate for Apartment C**
```
Variable (70%): (55.00 / 157.00) × 0.70 × 1000 = €245.22
Fixed (30%):    (0.1500 / 0.5000) × 0.30 × 1000 = €90.00
Total Heating C: €335.22
```

**Verification:** 393.39 + 271.39 + 335.22 = €1,000.00 ✓

---

#### **ELEVATOR:**

```
Apartments above ground: A (floor 1), C (floor 2)
Sum of floors: 1 + 2 = 3

Apartment A: (1 / 3) × 200 = €66.67
Apartment B: (ground floor) = €0.00
Apartment C: (2 / 3) × 200 = €133.33
```

**Verification:** 66.67 + 0.00 + 133.33 = €200.00 ✓

**Note:** Apartment C (2nd floor) pays **2x** more than A (1st floor), which is fair since it uses the elevator more!

---

#### **GENERAL EXPENSES:**

```
Total Square Meters: 100 + 80 + 60 = 240 m²

Apartment A: (100 / 240) × 300 = €125.00
Apartment B: (80 / 240) × 300  = €100.00
Apartment C: (60 / 240) × 300  = €75.00
```

**Verification:** 125.00 + 100.00 + 75.00 = €300.00 ✓

---

### **FINAL RESULTS:**

| Apartment | Heating | Elevator | General | **TOTAL** |
|-----------|---------|----------|---------|-----------|
| A         | €393.39 | €66.67   | €125.00 | **€585.06** |
| B         | €271.39 | €0.00    | €100.00 | **€371.39** |
| C         | €335.22 | €133.33  | €75.00  | **€543.55** |
| **TOTAL** | **€1,000.00** | **€200.00** | **€300.00** | **€1,500.00** |

---

## 🎯 **KEY INSIGHTS**

### Why Apartment A pays more than C despite less consumption?
- A has **higher ei** (0.75 vs 0.50) - larger volume apartment
- Even though C consumed more hours (110 vs 84), the volume coefficient matters
- The 30% fixed part also contributes based on fi × ei

### Why ground floor pays less?
- **No elevator cost** (€0 vs €100)
- Same **fi** as first floor (0.25) - but this can be adjusted if ground floor has less heat loss

### Typical fi values:
- **Ground floor**: 0.20 - 0.25 (less heat loss, protected by earth)
- **Mid floors**: 0.25 - 0.30 (protected above and below)
- **Top floor**: 0.30 - 0.35 (more heat loss through roof)
- **Corner apartments**: +0.05 (more external walls)

### Typical ei values:
- **Small apartments** (40-60 m²): 0.40 - 0.55
- **Medium apartments** (60-90 m²): 0.55 - 0.70
- **Large apartments** (90-120 m²): 0.70 - 0.85

---

## 📚 **LEGAL REFERENCES**

1. **Presidential Decree 1985** - Heating cost distribution with hourly/calorimeter meters
2. **Law 3741/1929 Article 5** - Common expenses distribution in condominiums
3. **koinoxrista24.gr** - Professional building management reference

---

## 💻 **IMPLEMENTATION IN CODE**

### Location:
- **File**: `frontend/src/components/CalculateExpenses.js`
- **Function**: `useMemo()` hook (lines 100-170)

### Data Models:
- **Apartment**: Contains `ei`, `fi`, `square_meters`, `floor`
- **Consumption**: Contains `consumption` (hours)
- **Expense**: Contains `total`, `type_expenses` (Heating/Elevator/General)

### Key Features:
- ✅ Automatic calculation on data change
- ✅ Validation that sums match total expenses
- ✅ Zero-consumption handling (apartment still pays 30% fixed)
- ✅ Ground floor elevator exemption
- ✅ Individual payment creation per apartment

---

## ⚠️ **IMPORTANT NOTES**

### Edge Cases:
1. **Zero consumption apartment**: Still pays 30% fixed heating (fi × ei contribution)
2. **All apartments closed**: Fixed part (30%) still distributes evenly by fi × ei
3. **Division by zero**: Protected with conditional checks (`sumEiWi > 0`)

### Data Requirements:
- All apartments must have **valid ei and fi values**
- Consumptions must be recorded for the current month
- Expenses must be categorized correctly (Heating/Elevator/General)

### Accuracy:
- All calculations use **floating point** arithmetic
- Results rounded to **2 decimal places** for display
- Total sum validation recommended after calculation

---

## 🔄 **UPDATING APARTMENTS**

When creating or editing apartments in ManageApartments.js:

1. **ei (Volume Factor)**: Get from mechanical engineer's heating study
2. **fi (Position Factor)**: 
   - Ground floor: 0.25
   - Mid floors: 0.30
   - Top floor: 0.35
   - Adjust based on orientation and exposure

3. **Square Meters**: Exact from property deed
4. **Floor**: 0 for ground, 1+ for above

---

## 📞 **SUPPORT**

For questions about calculation logic or implementation:
- Review this document first
- Check Presidential Decree 1985 official text
- Consult with building mechanical engineer for ei/fi values
- Visit koinoxrista24.gr for Greek building management standards

---

**Last Updated**: February 4, 2026
**Version**: 2.0 (Presidential Decree 1985 Compliant)
