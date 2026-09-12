extends Node2D

const PuzzlePieceScene := preload("res://scripts/puzzle_piece_v2.gd")

const PUZZLE_DIR := "res://assets/puzzles"
const DEFAULT_PUZZLE := "res://assets/puzzles/test.webp"
const COLUMNS := 4
const ROWS := 3
const CURVE_STEPS := 7
const SNAP_DISTANCE_PX := 42.0

var _rng := RandomNumberGenerator.new()
var _pieces: Array[PuzzlePieceV2] = []
var _board_origin: Vector2 = Vector2.ZERO
var _board_size: Vector2 = Vector2.ZERO
var _display_scale: float = 1.0
var _cell_display_size: Vector2 = Vector2.ZERO
var _locked_count: int = 0
var _status_label: Label
var _completion_layer: CanvasLayer


func _ready() -> void:
	_rng.randomize()
	call_deferred("_start_game")


func _start_game() -> void:
	var puzzle_path: String = _find_puzzle_image()
	if puzzle_path.is_empty():
		_show_missing_image_screen()
		return

	var texture := load(puzzle_path) as Texture2D
	if texture == null:
		_show_error_screen("Не удалось загрузить картинку:\n%s" % puzzle_path)
		return

	_build_game(texture, puzzle_path)


func _find_puzzle_image() -> String:
	if ResourceLoader.exists(DEFAULT_PUZZLE):
		return DEFAULT_PUZZLE

	var dir := DirAccess.open(PUZZLE_DIR)
	if dir == null:
		return ""

	var candidates: Array[String] = []
	dir.list_dir_begin()
	var file_name: String = dir.get_next()
	while not file_name.is_empty():
		if not dir.current_is_dir():
			var extension: String = file_name.get_extension().to_lower()
			if extension in ["webp", "png", "jpg", "jpeg"]:
				candidates.append(file_name)
		file_name = dir.get_next()
	dir.list_dir_end()

	candidates.sort()
	for candidate in candidates:
		var path: String = "%s/%s" % [PUZZLE_DIR, candidate]
		if ResourceLoader.exists(path):
			return path

	return ""


func _build_game(texture: Texture2D, puzzle_path: String) -> void:
	var screen_size: Vector2 = get_viewport_rect().size
	_build_background(screen_size)
	_build_header(screen_size, puzzle_path)

	var image_size: Vector2 = texture.get_size()
	if image_size.x <= 0.0 or image_size.y <= 0.0:
		_show_error_screen("У картинки некорректный размер.")
		return

	var image_aspect: float = image_size.x / image_size.y
	var max_board_size := Vector2(screen_size.x * 0.54, screen_size.y * 0.70)
	_board_size.x = minf(max_board_size.x, max_board_size.y * image_aspect)
	_board_size.y = _board_size.x / image_aspect
	_display_scale = _board_size.x / image_size.x
	_board_origin = Vector2(
		(screen_size.x - _board_size.x) * 0.5,
		95.0 + (screen_size.y - 95.0 - _board_size.y) * 0.5
	)

	var cell_source_size := Vector2(
		image_size.x / float(COLUMNS),
		image_size.y / float(ROWS)
	)
	_cell_display_size = cell_source_size * _display_scale

	_build_board_preview(texture)
	_generate_pieces(texture, cell_source_size)
	_update_status()


func _build_background(screen_size: Vector2) -> void:
	var background := ColorRect.new()
	background.position = Vector2.ZERO
	background.size = screen_size
	background.color = Color(0.033, 0.050, 0.080, 1.0)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	background.z_index = -100
	add_child(background)

	var header := ColorRect.new()
	header.position = Vector2.ZERO
	header.size = Vector2(screen_size.x, 82.0)
	header.color = Color(0.052, 0.077, 0.120, 0.98)
	header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	header.z_index = -90
	add_child(header)


func _build_header(screen_size: Vector2, puzzle_path: String) -> void:
	var title := Label.new()
	title.text = "ПАЗЛ — classic cut"
	title.position = Vector2(24.0, 13.0)
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", Color(0.93, 0.97, 1.0, 1.0))
	title.z_index = 2000
	add_child(title)

	var hint := Label.new()
	hint.text = "Перетаскивай детали на изображение. Близко к месту — деталь защёлкнется. R — перемешать заново."
	hint.position = Vector2(25.0, 47.0)
	hint.add_theme_font_size_override("font_size", 14)
	hint.add_theme_color_override("font_color", Color(0.60, 0.70, 0.82, 1.0))
	hint.z_index = 2000
	add_child(hint)

	_status_label = Label.new()
	_status_label.position = Vector2(screen_size.x - 185.0, 19.0)
	_status_label.size = Vector2(155.0, 36.0)
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_status_label.add_theme_font_size_override("font_size", 22)
	_status_label.add_theme_color_override("font_color", Color(0.45, 0.88, 1.0, 1.0))
	_status_label.z_index = 2000
	add_child(_status_label)

	print("Puzzle image: ", puzzle_path)


func _build_board_preview(texture: Texture2D) -> void:
	var board_panel := ColorRect.new()
	board_panel.position = _board_origin - Vector2(10.0, 10.0)
	board_panel.size = _board_size + Vector2(20.0, 20.0)
	board_panel.color = Color(0.075, 0.105, 0.155, 0.96)
	board_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	board_panel.z_index = -30
	add_child(board_panel)

	var preview := Sprite2D.new()
	preview.texture = texture
	preview.centered = false
	preview.position = _board_origin
	preview.scale = Vector2.ONE * _display_scale
	preview.modulate = Color(1.0, 1.0, 1.0, 0.10)
	preview.z_index = -20
	add_child(preview)

	var border := Line2D.new()
	border.points = PackedVector2Array([
		_board_origin,
		_board_origin + Vector2(_board_size.x, 0.0),
		_board_origin + _board_size,
		_board_origin + Vector2(0.0, _board_size.y)
	])
	border.closed = true
	border.width = 2.0
	border.default_color = Color(0.36, 0.63, 0.78, 0.50)
	border.antialiased = true
	add_child(border)


func _generate_pieces(texture: Texture2D, cell_source_size: Vector2) -> void:
	var vertical_edges: Array = _generate_vertical_edges()
	var horizontal_edges: Array = _generate_horizontal_edges()
	var piece_id: int = 0

	for row in range(ROWS):
		for column in range(COLUMNS):
			var top_edge: Dictionary = {} if row == 0 else horizontal_edges[row - 1][column]
			var right_edge: Dictionary = {} if column == COLUMNS - 1 else vertical_edges[row][column]
			var bottom_edge: Dictionary = {} if row == ROWS - 1 else horizontal_edges[row][column]
			var left_edge: Dictionary = {} if column == 0 else vertical_edges[row][column - 1]

			var top_sign: int = 0 if row == 0 else -int(top_edge["type"])
			var right_sign: int = 0 if column == COLUMNS - 1 else int(right_edge["type"])
			var bottom_sign: int = 0 if row == ROWS - 1 else int(bottom_edge["type"])
			var left_sign: int = 0 if column == 0 else -int(left_edge["type"])

			var polygon: PackedVector2Array = _build_piece_polygon(
				cell_source_size,
				top_edge,
				top_sign,
				right_edge,
				right_sign,
				bottom_edge,
				bottom_sign,
				left_edge,
				left_sign
			)

			var source_origin := Vector2(
				column * cell_source_size.x,
				row * cell_source_size.y
			)
			var uv_points := PackedVector2Array()
			for point in polygon:
				uv_points.append(source_origin + point)

			var target: Vector2 = _board_origin + source_origin * _display_scale
			var piece := PuzzlePieceScene.new() as PuzzlePieceV2
			piece.name = "Piece_%02d_%02d" % [row, column]
			add_child(piece)
			piece.setup(
				texture,
				polygon,
				uv_points,
				target,
				_display_scale,
				piece_id,
				SNAP_DISTANCE_PX
			)
			piece.locked_in_place.connect(_on_piece_locked)
			piece.place_scrambled(_random_scatter_position(target))
			_pieces.append(piece)
			piece_id += 1


func _generate_vertical_edges() -> Array:
	var result: Array = []
	for _row in range(ROWS):
		var edge_row: Array = []
		for _column in range(COLUMNS - 1):
			edge_row.append(_make_edge_descriptor())
		result.append(edge_row)
	return result


func _generate_horizontal_edges() -> Array:
	var result: Array = []
	for _row in range(ROWS - 1):
		var edge_row: Array = []
		for _column in range(COLUMNS):
			edge_row.append(_make_edge_descriptor())
		result.append(edge_row)
	return result


func _make_edge_descriptor() -> Dictionary:
	return {
		"type": 1 if _rng.randi_range(0, 1) == 0 else -1,
		"center": _rng.randf_range(0.465, 0.535),
		"neck": _rng.randf_range(0.052, 0.066),
		"head": _rng.randf_range(0.145, 0.168),
		"base": _rng.randf_range(0.195, 0.218),
		"depth": _rng.randf_range(0.180, 0.205)
	}


func _build_piece_polygon(
	cell_size: Vector2,
	top_edge: Dictionary,
	top_sign: int,
	right_edge: Dictionary,
	right_sign: int,
	bottom_edge: Dictionary,
	bottom_sign: int,
	left_edge: Dictionary,
	left_sign: int
) -> PackedVector2Array:
	var width: float = cell_size.x
	var height: float = cell_size.y
	var depth_base: float = minf(width, height)
	var points := PackedVector2Array()

	points.append_array(_sample_classic_edge(
		Vector2(0.0, 0.0),
		Vector2(width, 0.0),
		Vector2(0.0, -1.0),
		top_edge,
		top_sign,
		depth_base,
		false,
		false,
		false
	))
	points.append_array(_sample_classic_edge(
		Vector2(width, 0.0),
		Vector2(width, height),
		Vector2(1.0, 0.0),
		right_edge,
		right_sign,
		depth_base,
		false,
		true,
		false
	))
	points.append_array(_sample_classic_edge(
		Vector2(width, height),
		Vector2(0.0, height),
		Vector2(0.0, 1.0),
		bottom_edge,
		bottom_sign,
		depth_base,
		true,
		true,
		false
	))
	points.append_array(_sample_classic_edge(
		Vector2(0.0, height),
		Vector2(0.0, 0.0),
		Vector2(-1.0, 0.0),
		left_edge,
		left_sign,
		depth_base,
		true,
		true,
		true
	))

	return points


func _sample_classic_edge(
	from: Vector2,
	to: Vector2,
	outward_normal: Vector2,
	edge: Dictionary,
	sign_value: int,
	depth_base: float,
	reverse_profile: bool,
	skip_first: bool,
	skip_last: bool
) -> PackedVector2Array:
	if sign_value == 0 or edge.is_empty():
		return _straight_edge(from, to, skip_first, skip_last)

	var center: float = float(edge["center"])
	if reverse_profile:
		center = 1.0 - center

	var neck_half: float = float(edge["neck"])
	var head_half: float = float(edge["head"])
	var base_half: float = float(edge["base"])
	var depth: float = depth_base * float(edge["depth"])
	var direction: float = float(sign_value)

	var normalized := PackedVector2Array()
	normalized.append(Vector2(0.0, 0.0))
	normalized.append(Vector2(center - base_half, 0.0))

	_append_curve(normalized,
		Vector2(center - base_half, 0.0),
		Vector2(center - base_half * 0.62, 0.0),
		Vector2(center - neck_half, 0.055),
		Vector2(center - neck_half, 0.245)
	)
	_append_curve(normalized,
		Vector2(center - neck_half, 0.245),
		Vector2(center - neck_half * 0.92, 0.405),
		Vector2(center - head_half, 0.455),
		Vector2(center - head_half, 0.665)
	)
	_append_curve(normalized,
		Vector2(center - head_half, 0.665),
		Vector2(center - head_half * 0.96, 0.900),
		Vector2(center - head_half * 0.48, 1.0),
		Vector2(center, 1.0)
	)
	_append_curve(normalized,
		Vector2(center, 1.0),
		Vector2(center + head_half * 0.48, 1.0),
		Vector2(center + head_half * 0.96, 0.900),
		Vector2(center + head_half, 0.665)
	)
	_append_curve(normalized,
		Vector2(center + head_half, 0.665),
		Vector2(center + head_half, 0.455),
		Vector2(center + neck_half * 0.92, 0.405),
		Vector2(center + neck_half, 0.245)
	)
	_append_curve(normalized,
		Vector2(center + neck_half, 0.245),
		Vector2(center + neck_half, 0.055),
		Vector2(center + base_half * 0.62, 0.0),
		Vector2(center + base_half, 0.0)
	)

	normalized.append(Vector2(1.0, 0.0))

	var result := PackedVector2Array()
	for p in normalized:
		var point: Vector2 = from.lerp(to, p.x)
		point += outward_normal * p.y * depth * direction
		result.append(point)

	if skip_first and result.size() > 0:
		result.remove_at(0)
	if skip_last and result.size() > 0:
		result.remove_at(result.size() - 1)
	return result


func _append_curve(
	points: PackedVector2Array,
	p0: Vector2,
	p1: Vector2,
	p2: Vector2,
	p3: Vector2
) -> void:
	for index in range(1, CURVE_STEPS + 1):
		var t: float = float(index) / float(CURVE_STEPS)
		points.append(_cubic_bezier(p0, p1, p2, p3, t))


func _cubic_bezier(
	p0: Vector2,
	p1: Vector2,
	p2: Vector2,
	p3: Vector2,
	t: float
) -> Vector2:
	var one_minus_t: float = 1.0 - t
	return \
		p0 * (one_minus_t * one_minus_t * one_minus_t) + \
		p1 * (3.0 * one_minus_t * one_minus_t * t) + \
		p2 * (3.0 * one_minus_t * t * t) + \
		p3 * (t * t * t)


func _straight_edge(
	from: Vector2,
	to: Vector2,
	skip_first: bool,
	skip_last: bool
) -> PackedVector2Array:
	var result := PackedVector2Array([from, to])
	if skip_first and result.size() > 0:
		result.remove_at(0)
	if skip_last and result.size() > 0:
		result.remove_at(result.size() - 1)
	return result


func _random_scatter_position(target: Vector2) -> Vector2:
	var screen_size: Vector2 = get_viewport_rect().size
	var margin: float = 28.0
	var top_margin: float = 96.0
	var piece_size: Vector2 = _cell_display_size + Vector2(28.0, 28.0)
	var max_x: float = maxf(margin, screen_size.x - piece_size.x - margin)
	var max_y: float = maxf(top_margin, screen_size.y - piece_size.y - margin)
	var board_rect := Rect2(_board_origin, _board_size).grow(18.0)

	for _attempt in range(100):
		var candidate := Vector2(
			_rng.randf_range(margin, max_x),
			_rng.randf_range(top_margin, max_y)
		)
		var piece_rect := Rect2(candidate, piece_size)
		if not board_rect.intersects(piece_rect):
			return candidate

	var fallback := Vector2(
		_rng.randf_range(margin, max_x),
		_rng.randf_range(top_margin, max_y)
	)
	if fallback.distance_to(target) < SNAP_DISTANCE_PX * 2.0:
		fallback.x = margin
	return fallback


func _on_piece_locked(_piece: PuzzlePieceV2) -> void:
	_locked_count += 1
	_update_status()
	if _locked_count >= _pieces.size():
		_show_completion()


func _update_status() -> void:
	if is_instance_valid(_status_label):
		_status_label.text = "%d / %d" % [_locked_count, COLUMNS * ROWS]


func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_R:
			_reshuffle_all()


func _reshuffle_all() -> void:
	_locked_count = 0
	_hide_completion()
	for piece in _pieces:
		piece.place_scrambled(_random_scatter_position(piece.target_position))
	_update_status()


func _show_completion() -> void:
	_hide_completion()
	_completion_layer = CanvasLayer.new()
	_completion_layer.layer = 50
	add_child(_completion_layer)

	var screen_size: Vector2 = get_viewport_rect().size
	var panel := ColorRect.new()
	panel.position = Vector2(screen_size.x * 0.5 - 205.0, screen_size.y * 0.5 - 72.0)
	panel.size = Vector2(410.0, 144.0)
	panel.color = Color(0.045, 0.075, 0.12, 0.96)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_completion_layer.add_child(panel)

	var label := Label.new()
	label.position = panel.position + Vector2(20.0, 28.0)
	label.size = Vector2(370.0, 90.0)
	label.text = "Готово! 🎉\nПазл собран. Нажми R, чтобы перемешать ещё раз."
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 21)
	label.add_theme_color_override("font_color", Color(0.90, 0.97, 1.0, 1.0))
	_completion_layer.add_child(label)


func _hide_completion() -> void:
	if is_instance_valid(_completion_layer):
		_completion_layer.queue_free()
	_completion_layer = null


func _show_missing_image_screen() -> void:
	_show_message_screen(
		"Нет тестовой картинки",
		"Положи изображение сюда:\nres://assets/puzzles/test.webp\n\nРекомендуемый размер: 1600 × 1200 px (4:3).\nТакже поддерживаются PNG/JPG/JPEG/WebP."
	)


func _show_error_screen(message: String) -> void:
	_show_message_screen("Ошибка загрузки пазла", message)


func _show_message_screen(title_text: String, body_text: String) -> void:
	var screen_size: Vector2 = get_viewport_rect().size
	_build_background(screen_size)

	var title := Label.new()
	title.position = Vector2(80.0, 170.0)
	title.size = Vector2(screen_size.x - 160.0, 60.0)
	title.text = title_text
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color(0.91, 0.96, 1.0, 1.0))
	add_child(title)

	var body := Label.new()
	body.position = Vector2(120.0, 250.0)
	body.size = Vector2(screen_size.x - 240.0, 260.0)
	body.text = body_text
	body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_theme_font_size_override("font_size", 20)
	body.add_theme_color_override("font_color", Color(0.60, 0.74, 0.86, 1.0))
	add_child(body)
